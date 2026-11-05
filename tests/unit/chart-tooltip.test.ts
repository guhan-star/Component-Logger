import { describe, it, expect } from 'vitest';
import { getChartTooltipStyles } from '@/components/chart-tooltip';

describe('Unit Tests: Accessible Chart Tooltip Styling', () => {
  it('generates high-contrast dark theme tooltip styles matching Stark WMC design specifications', () => {
    const darkStyles = getChartTooltipStyles(false);

    // Dark mode specs from Part 2.3:
    // Background: #171A22
    // Text: #F5F5F5
    // Border: #343A46
    expect(darkStyles.contentStyle.backgroundColor.toUpperCase()).toBe('#171A22');
    expect(darkStyles.contentStyle.color.toUpperCase()).toBe('#F5F5F5');
    expect(darkStyles.contentStyle.borderColor.toUpperCase()).toBe('#343A46');
    expect(darkStyles.contentStyle.borderRadius).toBe('8px');
    expect(darkStyles.itemStyle.color.toUpperCase()).toBe('#F5F5F5');
    expect(darkStyles.labelStyle.color.toUpperCase()).toBe('#94A3B8');
  });

  it('generates high-contrast light theme tooltip styles matching specifications', () => {
    const lightStyles = getChartTooltipStyles(true);

    // Light mode specs from Part 2.4:
    // Background: #FFFFFF
    // Text: #0F172A
    // Border: #E2E8F0
    expect(lightStyles.contentStyle.backgroundColor.toUpperCase()).toBe('#FFFFFF');
    expect(lightStyles.contentStyle.color.toUpperCase()).toBe('#0F172A');
    expect(lightStyles.contentStyle.borderColor.toUpperCase()).toBe('#E2E8F0');
    expect(lightStyles.itemStyle.color.toUpperCase()).toBe('#0F172A');
    expect(lightStyles.labelStyle.color.toUpperCase()).toBe('#64748B');
  });
});
