import { FAQ } from '../../content/faq';

// Short answers to the questions people ask before trusting a file to a website.
const Faq = () => (
  <section className="faq" aria-labelledby="faq-title">
    <h2 id="faq-title">Questions</h2>
    {FAQ.map((item) => (
      <details key={item.question}>
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
      </details>
    ))}
  </section>
);

export default Faq;
