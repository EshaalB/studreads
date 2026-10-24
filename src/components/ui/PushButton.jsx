// The main call to action: a raised button that lifts on hover and presses down on click
// (adapted from a Uiverse design, in brand colours). Use one per view at most.
const PushButton = ({ children, type = 'button', className = '', ...props }) => (
  <button type={type} className={`push ${className}`} {...props}>
    <span className="push-shadow" aria-hidden="true" />
    <span className="push-edge" aria-hidden="true" />
    <span className="push-front">{children}</span>
  </button>
);

export default PushButton;
