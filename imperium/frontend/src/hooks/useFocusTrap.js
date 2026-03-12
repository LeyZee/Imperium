import { useEffect, useRef } from 'react';

export default function useFocusTrap(isOpen) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen || !ref.current) return;

    const trap = ref.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const closeBtn = trap.querySelector('[data-close], button[aria-label*="ermer"]');
        if (closeBtn) closeBtn.click();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = [...trap.querySelectorAll(focusableSelector)];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const focusable = [...trap.querySelectorAll(focusableSelector)];
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }

    trap.addEventListener('keydown', handleKeyDown);
    return () => trap.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return ref;
}
