import * as React from 'react';

const cx = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(' ');

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MastercardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="24">
    <circle cx="8" cy="12" r="7" fill="#EA001B" />
    <circle cx="16" cy="12" r="7" fill="#F79E1B" fillOpacity="0.8" />
  </svg>
);

const DashedLine = () => <div className="ticket-dashed-line" aria-hidden="true" />;

const Barcode = ({ value }: { value: string }) => {
  const bars = React.useMemo(() => {
    const hashCode = (input: string) =>
      input.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) & acc, 0);
    const seed = hashCode(value);
    const random = (seedValue: number) => {
      const x = Math.sin(seedValue) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: 60 }).map((_, index) => ({
      width: random(seed + index) > 0.7 ? 2.5 : 1.5,
    }));
  }, [value]);

  const spacing = 1.5;
  const totalWidth = bars.reduce((acc, bar) => acc + bar.width + spacing, 0) - spacing;
  const svgWidth = 250;
  const svgHeight = 70;
  let currentX = (svgWidth - totalWidth) / 2;

  return (
    <div className="ticket-barcode">
      <svg xmlns="http://www.w3.org/2000/svg" width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-label={`Barcode ${value}`}>
        {bars.map((bar, index) => {
          const x = currentX;
          currentX += bar.width + spacing;
          return <rect key={index} x={x} y="10" width={bar.width} height="50" />;
        })}
      </svg>
      <p>{value}</p>
    </div>
  );
};

const ConfettiExplosion = () => {
  const confetti = React.useMemo(() => {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#f97316'];
    return Array.from({ length: 90 }).map((_, index) => ({
      left: `${Math.random() * 100}%`,
      top: `${-20 + Math.random() * 10}%`,
      color: colors[index % colors.length],
      rotate: `rotate(${Math.random() * 360}deg)`,
      animation: `ticket-confetti-fall ${2.5 + Math.random() * 2.5}s ${Math.random() * 2}s linear forwards`,
    }));
  }, []);

  return (
    <div className="ticket-confetti" aria-hidden="true">
      {confetti.map((item, index) => (
        <div
          key={index}
          className="ticket-confetti-piece"
          style={{
            left: item.left,
            top: item.top,
            backgroundColor: item.color,
            transform: item.rotate,
            animation: item.animation,
          }}
        />
      ))}
    </div>
  );
};

export interface TicketProps extends React.HTMLAttributes<HTMLDivElement> {
  ticketId: string;
  amount: number;
  date: Date;
  cardHolder: string;
  last4Digits: string;
  barcodeValue: string;
  currency?: string;
}

export const AnimatedTicket = React.forwardRef<HTMLDivElement, TicketProps>(
  (
    {
      className,
      ticketId,
      amount,
      date,
      cardHolder,
      last4Digits,
      barcodeValue,
      currency = 'MXN',
      ...props
    },
    ref,
  ) => {
    const [showConfetti, setShowConfetti] = React.useState(false);

    React.useEffect(() => {
      const mountTimer = setTimeout(() => setShowConfetti(true), 100);
      const unmountTimer = setTimeout(() => setShowConfetti(false), 6000);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(unmountTimer);
      };
    }, []);

    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
    }).format(amount);

    const formattedDate = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
        <div ref={ref} className={cx('animated-ticket', className)} {...props}>
          <div className="ticket-cutout ticket-cutout-left" />
          <div className="ticket-cutout ticket-cutout-right" />

          <div className="ticket-success-head">
            <div className="ticket-success-icon">
              <CheckCircleIcon />
            </div>
            <h1>Pago confirmado</h1>
            <p>Tu ticket de videoconsulta fue emitido correctamente.</p>
          </div>

          <div className="ticket-details">
            <DashedLine />

            <div className="ticket-grid">
              <div>
                <p>Ticket ID</p>
                <strong>{ticketId}</strong>
              </div>
              <div className="ticket-right">
                <p>Monto</p>
                <strong>{formattedAmount}</strong>
              </div>
            </div>

            <div>
              <p className="ticket-label">Fecha y hora</p>
              <strong>{formattedDate}</strong>
            </div>

            <div className="ticket-card-line">
              <MastercardIcon />
              <div>
                <strong>{cardHolder || 'TITULAR DEMO'}</strong>
                <p>{last4Digits ? `**** ${last4Digits}` : '**** 4242'}</p>
              </div>
            </div>

            <DashedLine />
            <Barcode value={barcodeValue} />
          </div>
        </div>
      </>
    );
  },
);

AnimatedTicket.displayName = 'AnimatedTicket';
