import { HelpCircle, BookOpen, MessageCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Como funciona a busca de empresas?",
    answer: "A busca utiliza filtros do LinkedIn Sales Navigator como setor, localização, tamanho e faturamento para encontrar empresas relevantes. Os resultados são retornados em tempo real.",
  },
  {
    question: "Posso exportar os resultados?",
    answer: "Sim! Você pode exportar resultados em formato CSV diretamente da tabela de resultados, tanto para empresas quanto para contatos.",
  },
  {
    question: "Quantas buscas posso fazer por mês?",
    answer: "O limite depende do seu plano. O plano Pro permite até 500 buscas por mês. Consulte a aba de Assinatura nas Configurações.",
  },
  {
    question: "Como salvar contatos em listas?",
    answer: "Após realizar uma busca de contatos, você pode selecionar os resultados desejados e salvá-los em listas de prospecção personalizadas.",
  },
  {
    question: "Os filtros são compatíveis com o Sales Navigator?",
    answer: "Sim, todos os filtros e IDs são mapeados diretamente para o formato do LinkedIn Sales Navigator, garantindo resultados precisos.",
  },
];

const Help = () => {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Ajuda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre respostas e suporte para usar a plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: BookOpen, title: "Documentação", desc: "Guias e tutoriais completos" },
          { icon: MessageCircle, title: "Suporte", desc: "Fale com nossa equipe" },
          { icon: ExternalLink, title: "API Docs", desc: "Referência técnica da API" },
        ].map((item) => (
          <Card key={item.title} className="border border-border shadow-none cursor-pointer transition-colors hover:border-primary/30">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Perguntas frequentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-sm text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
