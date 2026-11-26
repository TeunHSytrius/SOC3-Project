import { Field, Select } from '../../components/Ui';

export const text = (name: string, label: string, required = true, value?: string) => (
    <Field label={label}>
      <input name={name} required={required} defaultValue={value} />
    </Field>
  );
export const area = (name: string, label: string, required = true) => (
    <Field label={label}>
      <textarea name={name} required={required} rows={4} />
    </Field>
  );
export const choose = (name: string, label: string, options: (string | { id: string; name: string })[], placeholder = 'Maak een keuze') => (
    <Field label={label}>
      <Select name={name} options={options} placeholder={placeholder} required />
    </Field>
  );
export const check = (name: string, label: string) => (
    <label className="check">
      <input name={name} type="checkbox" />
      {label}
    </label>
  );
