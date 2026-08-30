const prisma = require('../prisma');
const { AppError } = require('../utils/errors');

class WidgetService {
  async createWidget(tenantId, data) {
    if (!data.title || data.title.trim() === '') {
      throw new AppError('Widget title is required', 400);
    }

    const formFields = Array.isArray(data.formFields) && data.formFields.length > 0
      ? data.formFields
      : [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email Address', type: 'email', required: true }
        ];

    const widget = await prisma.widget.create({
      data: {
        tenantId,
        type: data.type || 'signup',
        title: data.title.trim(),
        description: data.description || null,
        formFields,
        buttonText: data.buttonText || 'Submit',
        displayOptions: data.displayOptions || {}
      }
    });

    return {
      ...widget,
      embedSnippet: `<script src="/widget.v1.js?id=${widget.id}"></script>`
    };
  }

  async listWidgets(tenantId) {
    const widgets = await prisma.widget.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { submissions: true }
        }
      }
    });

    return widgets.map(w => ({
      ...w,
      submissionCount: w._count.submissions,
      embedSnippet: `<script src="/widget.v1.js?id=${w.id}"></script>`
    }));
  }

  async getWidget(tenantId, id) {
    // Tenant-isolated query: must match BOTH id and tenantId
    const widget = await prisma.widget.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!widget) {
      throw new AppError('Widget not found', 404);
    }

    return {
      ...widget,
      embedSnippet: `<script src="/widget.v1.js?id=${widget.id}"></script>`
    };
  }

  async updateWidget(tenantId, id, data) {
    // Verify ownership first via tenant-isolated lookup
    const existing = await prisma.widget.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new AppError('Widget not found', 404);
    }

    const updated = await prisma.widget.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        type: data.type !== undefined ? data.type : undefined,
        formFields: data.formFields !== undefined ? data.formFields : undefined,
        buttonText: data.buttonText !== undefined ? data.buttonText : undefined,
        displayOptions: data.displayOptions !== undefined ? data.displayOptions : undefined
      }
    });

    return {
      ...updated,
      embedSnippet: `<script src="/widget.v1.js?id=${updated.id}"></script>`
    };
  }

  async deleteWidget(tenantId, id) {
    // Verify ownership first via tenant-isolated lookup
    const existing = await prisma.widget.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new AppError('Widget not found', 404);
    }

    await prisma.widget.delete({
      where: { id }
    });

    return { deleted: true };
  }
}

module.exports = new WidgetService();
