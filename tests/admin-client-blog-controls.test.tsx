// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlogSelect } from '../admin/client/src/components/BlogSelect';
import { BlogDateField } from '../admin/client/src/components/BlogDateField';

afterEach(() => cleanup());

describe('blog-styled admin form controls', () => {
  it('opens the themed select and chooses an option with the keyboard', () => {
    function Harness() {
      const [value, setValue] = useState('30');
      return (
        <BlogSelect
          ariaLabel="有效期"
          value={value}
          options={[
            { value: '7', label: '7 天' },
            { value: '30', label: '30 天' },
            { value: '90', label: '90 天' },
          ]}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: '有效期' });
    expect(trigger).toHaveTextContent('30 天');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox', { name: '有效期' })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(trigger).toHaveTextContent('90 天');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a themed calendar and returns an ISO date', () => {
    const onChange = vi.fn();
    render(
      <BlogDateField
        ariaLabel="发布日期"
        value="2026-08-15"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开发布日期日历' }));
    expect(screen.getByRole('dialog', { name: '发布日期日历' })).toBeInTheDocument();
    expect(screen.getByText('2026 年 8 月')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026年8月20日' }));
    expect(onChange).toHaveBeenCalledWith('2026-08-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
