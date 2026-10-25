// On touch screens a tap shows a class or exam in full before editing, since there is no
// hover to reveal what a narrow block hides.
import { shortDate } from '../../utils/dates';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

const ItemPreview = ({ item, onEdit, onRemove, onClose }) => (
  <Dialog
    isOpen={Boolean(item)}
    onClose={onClose}
    title={item?.title || ''}
    width={420}
    footer={<>
      <button type="button" className="btn btn-danger" onClick={() => { onClose(); onRemove(item.id); }}>Remove</button>
      <PushButton onClick={() => { onClose(); onEdit(item.id); }}>Edit</PushButton>
    </>}
  >
    {item && (
      <dl className="item-preview" style={{ '--block': item.color }}>
        {item.badge && <div><dt>Type</dt><dd>{item.badge === 'Exam' ? `Exam · ${shortDate(item.date)}` : item.badge}</dd></div>}
        <div><dt>Time</dt><dd>{item.time || 'Not listed'}</dd></div>
        {item.details.map((detail) => <div key={detail}><dt className="visually-hidden">Detail</dt><dd>{detail}</dd></div>)}
        {item.clash && <div><dt>Note</dt><dd className="text-warn">Clashes with another class or exam</dd></div>}
      </dl>
    )}
  </Dialog>
);

export default ItemPreview;
