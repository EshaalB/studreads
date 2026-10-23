import { ArrowRight } from 'lucide-react';

const ResumeCard = ({ title, detail, onContinue }) => (
  <div className="resume">
    <div className="resume-text">
      <span>Continue where you left off</span>
      <strong>{title}</strong>
      <small>{detail}</small>
    </div>
    <button type="button" className="btn btn-accent" onClick={onContinue}>Continue <ArrowRight size={15} /></button>
  </div>
);

export default ResumeCard;
