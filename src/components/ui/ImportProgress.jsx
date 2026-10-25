// A thin progress bar while a file is read. Messages that end in a percentage
// ("Recognising text (page 1 of 2, 45%)") fill it; others show a moving stripe.
const ImportProgress = ({ message }) => {
  const percent = Number(message.match(/(\d{1,3})%/)?.[1]);
  const known = Number.isFinite(percent);
  return (
    <div
      className={`import-progress ${known ? '' : 'is-waiting'}`}
      role="progressbar"
      aria-label={message}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
    >
      <span style={known ? { transform: `scaleX(${Math.min(percent, 100) / 100})` } : undefined} />
    </div>
  );
};

export default ImportProgress;
