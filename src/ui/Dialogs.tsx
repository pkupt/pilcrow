import { signal } from '@preact/signals';

export interface DialogButton {
  label: string;
  value: string;
  primary?: boolean;
}

export interface DialogState {
  title: string;
  message: string;
  buttons: DialogButton[];
}

export const dialogState = signal<DialogState | null>(null);

interface PendingDialog {
  state: DialogState;
  resolve: (value: string) => void;
}

const pending: PendingDialog[] = [];
let current: PendingDialog | null = null;

export function askDialog(state: DialogState): Promise<string> {
  return new Promise((resolve) => {
    pending.push({ state, resolve });
    showNext();
  });
}

function showNext(): void {
  if (current !== null || pending.length === 0) return;
  current = pending.shift()!;
  dialogState.value = current.state;
}

export function closeDialog(value: string): void {
  const next = current;
  current = null;
  if (next !== null) {
    dialogState.value = null;
    next.resolve(value);
  }
  showNext();
}

export function DialogHost() {
  const state = dialogState.value;
  if (state === null) return null;
  return (
    <div class="modal-overlay" onClick={() => closeDialog('')}>
      <div class="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 class="modal-title">{state.title}</h2>
        <p class="modal-message">{state.message}</p>
        <div class="modal-actions">
          {state.buttons.map((b) => (
            <button key={b.value} class={b.primary ? 'primary' : ''} onClick={() => closeDialog(b.value)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
