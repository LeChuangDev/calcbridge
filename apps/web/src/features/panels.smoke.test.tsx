// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnitSystemProvider } from '@/providers/UnitSystemProvider';
import { LedResistorPanel } from './led-resistor/LedResistorPanel';
import { SkinDepthPanel } from './skin-depth/SkinDepthPanel';

/** 新增面板的渲染冒烟：默认值即出结果，改输入即时重算。 */
describe('新增计算器面板', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('LED 面板默认即算出 285 Ω 附近的标准阻值与实际电流', () => {
    render(
      <UnitSystemProvider>
        <LedResistorPanel />
      </UnitSystemProvider>,
    );
    expect(screen.getByRole('heading', { name: 'LED 限流电阻' })).toBeTruthy();
    // 12 V / 3×2.1 V / 20 mA → 理论 285 Ω，E24 取 300 Ω
    expect(screen.getByText('已选型')).toBeTruthy();
    expect(screen.getAllByText(/300/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/285/).length).toBeGreaterThan(0);
  });

  it('LED 面板：供电不足时给出可读错误而不是崩溃', () => {
    render(
      <UnitSystemProvider>
        <LedResistorPanel />
      </UnitSystemProvider>,
    );
    const vin = screen.getByLabelText('供电电压 Vin');
    fireEvent.change(vin, { target: { value: '5' } });
    expect(screen.getAllByText(/供电电压需大于/).length).toBeGreaterThan(0);
  });

  it('趋肤深度面板默认 1 GHz / 35 µm 铜厚给出趋肤深度与饱和提示', () => {
    render(
      <UnitSystemProvider>
        <SkinDepthPanel />
      </UnitSystemProvider>,
    );
    expect(screen.getByRole('heading', { name: '趋肤深度' })).toBeTruthy();
    expect(screen.getAllByText(/µm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('铜厚已饱和').length).toBeGreaterThan(0);
  });
});
