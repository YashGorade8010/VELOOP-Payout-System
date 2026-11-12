import { CircleHelp, X } from 'lucide-react';

export default function InlineNotice({ styles, message, onDismiss }) {
  if (!message) return null;

  return (
    <div className={styles.notice} role="alert">
      <CircleHelp size={17} />
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}
