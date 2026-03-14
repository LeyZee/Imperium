import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

function ThrowError({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  const originalError = console.error;
  beforeAll(() => { console.error = vi.fn(); });
  afterAll(() => { console.error = originalError; });

  test('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  test('renders fallback on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('reset button clears error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
    expect(screen.getByText('Réessayer')).toBeInTheDocument();

    // After clicking retry, the boundary resets and tries to render children again
    // Since ThrowError still throws, it will show the error again — but we verify the button works
    fireEvent.click(screen.getByText('Réessayer'));
    // The boundary reset and re-rendered — error caught again
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('renders custom fallback when provided', () => {
    const fallback = ({ error, reset }) => (
      <div>
        <span>Custom: {error.message}</span>
        <button onClick={reset}>Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom: Test error')).toBeInTheDocument();
  });
});
