const prisma = require('../prisma');
const { AppError } = require('../utils/errors');
const path = require('path');
const fs = require('fs');

async function getWidgetConfig(req, res, next) {
  try {
    const { id } = req.params;

    const widget = await prisma.widget.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        formFields: true,
        buttonText: true,
        displayOptions: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!widget) {
      return res.status(404).json({
        error: 'Widget Not Found',
        message: `No widget found with id: ${id}`
      });
    }

    // Short-lived cache control for dynamic config (5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
      success: true,
      data: widget
    });
  } catch (error) {
    next(error);
  }
}

function serveWidgetScript(req, res, next) {
  try {
    const filePath = path.join(__dirname, '../../public/widget.js');

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('// Widget script not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Long-lived cache for versioned bundle (1 year, immutable)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.type('application/javascript');

    return res.send(content);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getWidgetConfig,
  serveWidgetScript
};
