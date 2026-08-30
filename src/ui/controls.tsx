import React from 'react';

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint ? <div className="hint">{hint}</div> : null}
  </div>
);

export const Select: React.FC<{
  label: string;
  hint?: string;
  value: string;
  options: (string | { id: string; label: string })[];
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, hint, value, options, onChange, disabled }) => (
  <Field label={label} hint={hint}>
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => {
        const id = typeof o === 'string' ? o : o.id;
        const text = typeof o === 'string' ? o : o.label;
        return (
          <option key={id} value={id}>
            {text}
          </option>
        );
      })}
    </select>
  </Field>
);

export const TextInput: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  password?: boolean;
}> = ({ label, hint, value, onChange, placeholder, password }) => (
  <Field label={label} hint={hint}>
    <input
      type={password ? 'password' : 'text'}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  </Field>
);

export const TextArea: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, hint, value, onChange, placeholder, rows }) => (
  <Field label={label} hint={hint}>
    <textarea rows={rows || 3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </Field>
);

export const Slider: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step, suffix, onChange }) => (
  <Field label={label} hint={hint}>
    <div className="range-row">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="value">
        {value}
        {suffix || ''}
      </span>
    </div>
  </Field>
);

export const Check: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <label className="checkline">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>
      <span className="t">{label}</span>
      {hint ? <div className="s">{hint}</div> : null}
    </span>
  </label>
);

export const Note: React.FC<{
  kind?: 'info' | 'good' | 'warn' | 'error';
  title?: string;
  children: React.ReactNode;
}> = ({ kind = 'info', title, children }) => (
  <div className={'note ' + kind}>
    {title ? <b>{title}</b> : null}
    {children}
  </div>
);

export const Spinner: React.FC = () => <span className="spinner" />;

export const ErrorNote: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <Note kind="error" title="That did not work">
      {error}
    </Note>
  ) : null;
