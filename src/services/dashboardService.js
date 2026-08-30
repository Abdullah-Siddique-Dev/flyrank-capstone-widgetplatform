const prisma = require('../prisma');
const { AppError } = require('../utils/errors');

class DashboardService {
  async getSummary(tenantId) {
    // 1. Total counts
    const [totalWidgets, totalSubmissions, spamSubmissions] = await Promise.all([
      prisma.widget.count({ where: { tenantId } }),
      prisma.submission.count({ where: { tenantId } }),
      prisma.submission.count({ where: { tenantId, isSpam: true } })
    ]);

    // 2. Submissions over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissions = await prisma.submission.findMany({
      where: {
        tenantId,
        submittedAt: { gte: thirtyDaysAgo }
      },
      select: {
        submittedAt: true,
        country: true
      },
      orderBy: { submittedAt: 'asc' }
    });

    // Group submissions by Date (YYYY-MM-DD)
    const timelineMap = {};
    const countryMap = {};

    submissions.forEach(sub => {
      const day = sub.submittedAt.toISOString().split('T')[0];
      timelineMap[day] = (timelineMap[day] || 0) + 1;

      const c = sub.country || 'Unknown';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });

    const submissionsOverTime = Object.keys(timelineMap).map(date => ({
      date,
      count: timelineMap[date]
    }));

    const topCountries = Object.keys(countryMap)
      .map(country => ({ country, count: countryMap[country] }))
      .sort((a, b) => b.count - a.count);

    // 3. Recent 5 submissions
    const recentSubmissions = await prisma.submission.findMany({
      where: { tenantId },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      include: {
        widget: {
          select: { id: true, title: true }
        }
      }
    });

    return {
      totalWidgets,
      totalSubmissions,
      validSubmissions: totalSubmissions - spamSubmissions,
      spamSubmissions,
      submissionsOverTime,
      topCountries,
      recentSubmissions
    };
  }

  async getWidgetSubmissions(tenantId, widgetId, options = {}) {
    // Verify widget belongs to tenant
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, tenantId }
    });

    if (!widget) {
      throw new AppError('Widget not found', 404);
    }

    const page = Math.max(1, parseInt(options.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(options.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: { widgetId, tenantId },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.submission.count({
        where: { widgetId, tenantId }
      })
    ]);

    return {
      widget: {
        id: widget.id,
        title: widget.title,
        type: widget.type
      },
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getWidgetStats(tenantId, widgetId) {
    // Verify widget belongs to tenant
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, tenantId }
    });

    if (!widget) {
      throw new AppError('Widget not found', 404);
    }

    const [total, spam, rawSubs] = await Promise.all([
      prisma.submission.count({ where: { widgetId, tenantId } }),
      prisma.submission.count({ where: { widgetId, tenantId, isSpam: true } }),
      prisma.submission.findMany({
        where: { widgetId, tenantId },
        select: { country: true, city: true, submittedAt: true }
      })
    ]);

    const countryMap = {};
    const cityMap = {};

    rawSubs.forEach(s => {
      const c = s.country || 'Unknown';
      countryMap[c] = (countryMap[c] || 0) + 1;

      if (s.city) {
        cityMap[s.city] = (cityMap[s.city] || 0) + 1;
      }
    });

    const geoBreakdown = Object.keys(countryMap)
      .map(country => ({ country, count: countryMap[country] }))
      .sort((a, b) => b.count - a.count);

    const cityBreakdown = Object.keys(cityMap)
      .map(city => ({ city, count: cityMap[city] }))
      .sort((a, b) => b.count - a.count);

    return {
      widgetId: widget.id,
      widgetTitle: widget.title,
      totalSubmissions: total,
      validSubmissions: total - spam,
      spamSubmissions: spam,
      geoBreakdown,
      cityBreakdown
    };
  }
}

module.exports = new DashboardService();
