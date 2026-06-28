interface Faq {
  question: string
  answer: string
}

interface FaqSectionProps {
  faqs: Faq[]
}

export function FaqSection({ faqs }: FaqSectionProps) {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions fréquentes</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tout ce que vous devez savoir avant de démarrer.
          </p>
        </div>
        <div className="w-full">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group border-b border-border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-left text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {faq.question}
                <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <p className="pb-4 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
