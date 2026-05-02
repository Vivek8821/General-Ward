const pharmacyRepository = require('../repositories/PharmacyRepository');

class PharmacyAnalyticsService {
  /**
   * Calculates consumption stats for all medications in a tenant.
   * @param {string} tenantId 
   * @param {number} daysLookback Default is 7 days
   */
  async getConsumptionStats(tenantId, daysLookback = 7) {
    const inventory = await pharmacyRepository.listStock(tenantId);
    const history = await pharmacyRepository.getDispenseHistory(tenantId, daysLookback);

    // Map history for quick lookup
    const historyMap = history.reduce((acc, curr) => {
      acc[curr.medicationId] = curr.totalDispensed;
      return acc;
    }, {});

    const stats = inventory.map(item => {
      const totalDispensed = historyMap[item.id] || 0;
      const dailyBurnRate = totalDispensed / daysLookback;
      
      let runwayDays = null;
      if (dailyBurnRate > 0) {
        runwayDays = Math.floor(item.totalQuantity / dailyBurnRate);
      } else if (item.totalQuantity > 0) {
        runwayDays = 999; // Essentially infinite with 0 burn rate
      } else {
        runwayDays = 0;
      }

      let status = 'healthy';
      if (runwayDays <= 3) status = 'critical';
      else if (runwayDays <= 7) status = 'warning';

      return {
        medicationId: item.id,
        name: item.name,
        totalQuantity: item.totalQuantity,
        itemUnit: item.itemUnit,
        totalDispensed,
        dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
        runwayDays,
        status
      };
    });

    return stats;
  }

  /**
   * Get high-risk items (runway <= 7 days)
   */
  async getRiskAnalysis(tenantId) {
    const stats = await this.getConsumptionStats(tenantId);
    return stats.filter(s => s.status !== 'healthy' || s.totalQuantity === 0);
  }

  /**
   * Calculates financial impact and valuation of inventory.
   */
  async getFinancialAnalytics(tenantId) {
    const inventory = await pharmacyRepository.listStock(tenantId);
    const stats = await this.getConsumptionStats(tenantId);
    
    const statsMap = stats.reduce((acc, curr) => {
      acc[curr.medicationId] = curr;
      return acc;
    }, {});

    let totalValuation = 0;
    let totalDailyBurnValue = 0;

    const breakdown = inventory.map(item => {
      const itemStats = statsMap[item.id] || { dailyBurnRate: 0 };
      const costPerUnit = Number(item.costPerUnit) || 0;
      const valuation = item.totalQuantity * costPerUnit;
      const dailyBurnValue = itemStats.dailyBurnRate * costPerUnit;

      totalValuation += valuation;
      totalDailyBurnValue += dailyBurnValue;

      return {
        medicationId: item.id,
        name: item.name,
        costPerUnit,
        valuation: parseFloat(valuation.toFixed(2)),
        dailyBurnValue: parseFloat(dailyBurnValue.toFixed(2))
      };
    });

    return {
      totalValuation: parseFloat(totalValuation.toFixed(2)),
      totalDailyBurnValue: parseFloat(totalDailyBurnValue.toFixed(2)),
      breakdown
    };
  }

  /**
   * Generates a suggested replenishment plan to maintain 30-day stock levels.
   */
  async getReplenishmentPlan(tenantId) {
    const stats = await this.getConsumptionStats(tenantId);
    const targetDays = 30;
    const bufferMultiplier = 1.1; // 10% buffer

    const suggestions = stats
      .map(item => {
        const targetQuantity = Math.ceil(item.dailyBurnRate * targetDays * bufferMultiplier);
        const suggestedOrder = Math.max(0, targetQuantity - item.totalQuantity);

        if (suggestedOrder === 0 && item.totalQuantity > 0) return null;

        return {
          medicationId: item.medicationId,
          name: item.name,
          currentQuantity: item.totalQuantity,
          dailyBurnRate: item.dailyBurnRate,
          targetQuantity,
          suggestedOrder,
          urgency: item.status === 'critical' ? 'HIGH' : item.status === 'warning' ? 'MEDIUM' : 'LOW'
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const urgencyScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return urgencyScore[b.urgency] - urgencyScore[a.urgency] || b.suggestedOrder - a.suggestedOrder;
      });

    return suggestions;
  }
}

module.exports = new PharmacyAnalyticsService();
