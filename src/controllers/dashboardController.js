const dashboardService = require('../services/dashboardService');

async function getSummary(req, res, next) {
  try {
    const data = await dashboardService.getSummary(req.user.tenantId);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getWidgetSubmissions(req, res, next) {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const data = await dashboardService.getWidgetSubmissions(req.user.tenantId, id, { page, limit });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getWidgetStats(req, res, next) {
  try {
    const { id } = req.params;
    const data = await dashboardService.getWidgetStats(req.user.tenantId, id);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary,
  getWidgetSubmissions,
  getWidgetStats
};
