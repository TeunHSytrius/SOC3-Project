import { Button } from '../../components/Ui';
import { formData } from './formData';
import type { DialogProps } from './dialogTypes';
import { getAdminDialog } from '../admin/adminDialogs';

export default function ActionDialog(props: DialogProps) {
  const { state: currentState, update } = props;
  const definition = getAdminDialog(props);
  if (!definition) return null;
  const { title, fields, submit } = definition;

  return (
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !currentState.busy) update({ modal: null });
      }}
    >
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialoghead">
          <h2>{title}</h2>
          <button type="button" aria-label="Sluiten" disabled={currentState.busy} onClick={() => update({ modal: null })}>
            ×
          </button>
        </div>
        {currentState.error && (
          <div className="error" role="alert">
            {currentState.error}
          </div>
        )}
        <form onSubmit={(event) => submit(formData(event))}>
          {fields}
          <div className="actions">
            <Button disabled={currentState.busy} onClick={() => update({ modal: null, error: '' })}>Annuleren</Button>
            <Button primary type="submit" disabled={currentState.busy}>
              {currentState.busy ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
