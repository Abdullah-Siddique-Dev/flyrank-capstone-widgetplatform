const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const config = require('../config');
const { AppError } = require('../utils/errors');

class AuthService {
  async register({ email, password, tenantName }) {
    if (!email || !email.includes('@')) {
      throw new AppError('Valid email address is required', 400);
    }
    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      throw new AppError('Email is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName ? tenantName.trim() : `${normalizedEmail.split('@')[0]}'s Org`
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          passwordHash
        }
      });

      return { user, tenant };
    });

    const token = this.generateToken(result.user);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        tenantId: result.user.tenantId,
        tenantName: result.tenant.name
      },
      token
    };
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true }
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || 'Organization'
      },
      token
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || 'Organization',
      createdAt: user.createdAt
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );
  }
}

module.exports = new AuthService();
