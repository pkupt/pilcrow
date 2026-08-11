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

let resolver: ((value: string) => void) | null = null;

export function askDialog(state: DialogState): Promise<string> {
  dialogState.value = state;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function closeDialog(value: string): void {
  dialogState.value = null;
  if (resolver) {
    resolver(value);
    resolver = null;
  }
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
