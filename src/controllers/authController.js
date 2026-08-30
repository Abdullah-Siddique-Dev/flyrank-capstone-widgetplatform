const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const { email, password, tenantName } = req.body;
    const result = await authService.register({ email, password, tenantName });
    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.userId);
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  me
};
