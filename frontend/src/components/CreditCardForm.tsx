import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';

export type CardState = {
  number: string;
  holder: string;
  month: string;
  year: string;
  cvv: string;
};

export type CardValidity = {
  number: boolean;
  holder: boolean;
  month: boolean;
  year: boolean;
  cvv: boolean;
  allValid: boolean;
};

type Props = {
  defaultNumber?: string;
  defaultHolder?: string;
  defaultMonth?: string;
  defaultYear?: string;
  defaultCVV?: string;
  maskMiddle?: boolean;
  ring1?: string;
  ring2?: string;
  showSubmit?: boolean;
  submitLabel?: string;
  incompleteLabel?: string;
  onChange?: (state: CardState, validity: CardValidity) => void;
  onSubmit?: (state: CardState, validity: CardValidity) => void;
  className?: string;
};

function formatNumberSpaces(num: string): string {
  return num.replace(/\s+/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

function clampDigits(value: string, maxLen: number) {
  return value.replace(/\D/g, '').slice(0, maxLen);
}

function passesLuhn(value: string) {
  if (value.length < 13) return false;
  let sum = 0;
  let shouldDouble = false;

  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function CreditCardForm({
  defaultNumber = '',
  defaultHolder = '',
  defaultMonth = '',
  defaultYear = '',
  defaultCVV = '',
  maskMiddle = true,
  ring1 = '#ff6be7',
  ring2 = '#7288ff',
  showSubmit = true,
  submitLabel = 'Pagar consulta',
  incompleteLabel = 'Completa los campos',
  onChange,
  onSubmit,
  className = '',
}: Props) {
  const [number, setNumber] = useState(clampDigits(defaultNumber, 19));
  const [holder, setHolder] = useState(defaultHolder.toUpperCase());
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [cvv, setCVV] = useState(clampDigits(defaultCVV, 4));
  const [focusField, setFocusField] = useState<null | 'number' | 'holder' | 'expire' | 'cvv'>(null);

  const years = useMemo(() => {
    const start = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => String(start + index));
  }, []);

  const validity: CardValidity = useMemo(() => {
    const numberValid = passesLuhn(number);
    const holderValid = holder.trim().length >= 2;
    const monthValid = !!month && +month >= 1 && +month <= 12;
    const yearValid = !!year && +year >= new Date().getFullYear();
    const cvvValid = /^\d{3,4}$/.test(cvv);

    return {
      number: numberValid,
      holder: holderValid,
      month: monthValid,
      year: yearValid,
      cvv: cvvValid,
      allValid: numberValid && holderValid && monthValid && yearValid && cvvValid,
    };
  }, [number, holder, month, year, cvv]);

  useEffect(() => {
    onChange?.({ number, holder, month, year, cvv }, validity);
  }, [number, holder, month, year, cvv, validity, onChange]);

  const displayedSlots = useMemo(() => {
    const displayDigits = number.slice(0, 16).split('');
    return Array.from({ length: 16 }, (_, index) => {
      let content = '#';
      if (index < displayDigits.length) {
        const shouldMask = maskMiddle && index >= 4 && index <= 11;
        content = shouldMask ? '*' : displayDigits[index];
      }
      return { content, filled: index < displayDigits.length };
    });
  }, [number, maskMiddle]);

  const highlightClass = (() => {
    switch (focusField) {
      case 'number':
        return 'highlight__number';
      case 'holder':
        return 'highlight__holder';
      case 'expire':
        return 'highlight__expire';
      case 'cvv':
        return 'highlight__cvv';
      default:
        return 'hidden';
    }
  })();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.({ number, holder, month, year, cvv }, validity);
  };

  return (
    <section
      className={`credit-card-payment ${className}`}
      style={{ '--cc-ring1': ring1, '--cc-ring2': ring2 } as CSSProperties}
    >
      <div className="cc-wrap">
        <section className={`cc-card ${focusField === 'cvv' ? 'flip' : ''}`} aria-label="Tarjeta bancaria interactiva">
          <div className={`cc-highlight ${highlightClass}`} />

          <section className="cc-card-front">
            <div className="cc-card-header">
              <div>TeleMed Pay</div>
              <svg xmlns="http://www.w3.org/2000/svg" height="40" width="60" viewBox="-96 -98.908 832 593.448">
                <path fill="#ff5f00" d="M224.833 42.298h190.416v311.005H224.833z" />
                <path d="M244.446 197.828a197.448 197.448 0 0175.54-155.475 197.777 197.777 0 100 311.004 197.448 197.448 0 01-75.54-155.53z" fill="#eb001b" />
                <path d="M621.101 320.394v-6.372h2.747v-1.319h-6.537v1.319h2.582v6.373zm12.691 0v-7.69h-1.978l-2.307 5.493-2.308-5.494h-1.977v7.691h1.428v-5.823l2.143 5h1.483l2.143-5v5.823z" fill="#f79e1b" />
                <path d="M640 197.828a197.777 197.777 0 01-320.015 155.474 197.777 197.777 0 000-311.004A197.777 197.777 0 01640 197.773z" fill="#f79e1b" />
              </svg>
            </div>

            <div className="cc-card-number" aria-label="Numero de tarjeta">
              {displayedSlots.map((slot, index) => (
                <span key={index} className="cc-slot">
                  <span className={`cc-digit ${slot.filled ? 'filled' : ''}`}>
                    <span className="cc-row placeholder">#</span>
                    <span className="cc-row value">{slot.content}</span>
                  </span>
                </span>
              ))}
            </div>

            <div className="cc-card-footer">
              <div className="cc-card-holder">
                <div className="cc-section-title">Titular</div>
                <div>{holder || 'NOMBRE EN TARJETA'}</div>
              </div>
              <div className="cc-card-expires">
                <div className="cc-section-title">Expira</div>
                <span>{month || 'MM'}</span>/<span>{year ? year.slice(-2) : 'AA'}</span>
              </div>
            </div>
          </section>

          <section className="cc-card-back">
            <div className="cc-hide-line" />
            <div className="cc-cvv">
              <span>CVV</span>
              <div className="cc-cvv-field">{'*'.repeat(cvv.length)}</div>
            </div>
          </section>
        </section>

        <form className="cc-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="number">Numero de tarjeta</label>
            <input
              id="number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={formatNumberSpaces(number)}
              onChange={(event) => setNumber(clampDigits(event.target.value, 19))}
              onFocus={() => setFocusField('number')}
              onBlur={() => setFocusField(null)}
              aria-invalid={number.length > 0 && !validity.number}
            />
            {!validity.number && number.length >= 13 && <small className="cc-error">El numero no pasa validacion Luhn.</small>}
          </div>

          <div>
            <label htmlFor="holder">Titular</label>
            <input
              id="holder"
              type="text"
              autoComplete="cc-name"
              placeholder="JANE DOE"
              value={holder}
              onChange={(event) => setHolder(event.target.value.toUpperCase())}
              onFocus={() => setFocusField('holder')}
              onBlur={() => setFocusField(null)}
              aria-invalid={holder.length > 0 && !validity.holder}
            />
          </div>

          <div className="cc-field-group">
            <div>
              <label>Vencimiento</label>
              <div className="cc-date-grid">
                <select
                  value={month || ''}
                  onChange={(event) => setMonth(event.target.value)}
                  onFocus={() => setFocusField('expire')}
                  onBlur={() => setFocusField(null)}
                  aria-label="Mes de vencimiento"
                  aria-invalid={month.length > 0 && !validity.month}
                >
                  <option value="" disabled>Mes</option>
                  {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select
                  value={year || ''}
                  onChange={(event) => setYear(event.target.value)}
                  onFocus={() => setFocusField('expire')}
                  onBlur={() => setFocusField(null)}
                  aria-label="Ano de vencimiento"
                  aria-invalid={year.length > 0 && !validity.year}
                >
                  <option value="" disabled>Ano</option>
                  {years.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="cvv">CVV</label>
              <input
                id="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={cvv}
                onChange={(event) => setCVV(clampDigits(event.target.value, 4))}
                onFocus={() => setFocusField('cvv')}
                onBlur={() => setFocusField(null)}
                aria-invalid={cvv.length > 0 && !validity.cvv}
              />
            </div>
          </div>

          {showSubmit && (
            <button className="cc-submit" type="submit" disabled={!validity.allValid} aria-disabled={!validity.allValid}>
              {validity.allValid ? submitLabel : incompleteLabel}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
