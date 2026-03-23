import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../components/Toast';

function TestButton() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.warning('Warning message')}>Show Warning</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
    </div>
  );
}

describe('ToastProvider', () => {
  test('renders children', () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  test('shows success toast', () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  test('shows error toast', () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  test('toast container has aria-live attribute', () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Info'));
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  test('close button has aria-label', () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    const closeBtn = screen.getByLabelText('Fermer la notification');
    expect(closeBtn).toBeInTheDocument();
  });

  test('close button removes toast', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Fermer la notification');
    fireEvent.click(closeBtn);

    // Wait for exit animation
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  test('multiple toasts can coexist', () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });
});

describe('useToast', () => {
  test('throws when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      try {
        useToast();
      } catch (e) {
        return <div>Error: {e.message}</div>;
      }
      return null;
    }

    render(<BadComponent />);
    expect(screen.getByText(/useToast must be used within ToastProvider/)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
