const widgetService = require('../services/widgetService');

async function createWidget(req, res, next) {
  try {
    const result = await widgetService.createWidget(req.user.tenantId, req.body);
    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function listWidgets(req, res, next) {
  try {
    const result = await widgetService.listWidgets(req.user.tenantId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getWidget(req, res, next) {
  try {
    const result = await widgetService.getWidget(req.user.tenantId, req.params.id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateWidget(req, res, next) {
  try {
    const result = await widgetService.updateWidget(req.user.tenantId, req.params.id, req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function deleteWidget(req, res, next) {
  try {
    await widgetService.deleteWidget(req.user.tenantId, req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createWidget,
  listWidgets,
  getWidget,
  updateWidget,
  deleteWidget
};
