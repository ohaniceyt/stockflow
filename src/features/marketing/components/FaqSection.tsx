import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
        <Accordion defaultValue={[]} className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index.toString()}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
