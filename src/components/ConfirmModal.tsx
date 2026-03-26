import './ConfirmModal.css';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirmer', cancelLabel = 'Annuler' }: ConfirmModalProps) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-buttons">
          <button className="confirm-btn confirm-yes" onClick={onConfirm}>{confirmLabel}</button>
          <button className="confirm-btn confirm-no" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
