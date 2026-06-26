import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuote,
  createInvoice,
  createDeliveryNote,
  getQuotes,
  getInvoices,
  getDeliveryNotes,
  getInvoiceWithItems,
  getQuoteWithItems,
  getDeliveryNoteWithItems,
  updateDocumentStatus,
  convertQuoteToInvoice,
  recordPayment,
  markDeliveryNoteDelivered,
} from '@/features/invoicing/services/invoiceService';
import type { PaymentMethod } from '@/types';

const invoicesKeys = {
  all: ['invoices'] as const,
  quotes: (orgId: string) => ['invoices', 'quotes', orgId] as const,
  invoices: (orgId: string) => ['invoices', 'invoices', orgId] as const,
  deliveryNotes: (orgId: string) => ['invoices', 'delivery-notes', orgId] as const,
  quote: (id: string) => ['invoices', 'quote', id] as const,
  invoice: (id: string) => ['invoices', 'invoice', id] as const,
  deliveryNote: (id: string) => ['invoices', 'delivery-note', id] as const,
};

export function useQuotes(orgId: string) {
  return useQuery({
    queryKey: invoicesKeys.quotes(orgId),
    queryFn: () => getQuotes(orgId),
    enabled: Boolean(orgId),
  });
}

export function useInvoices(orgId: string) {
  return useQuery({
    queryKey: invoicesKeys.invoices(orgId),
    queryFn: () => getInvoices(orgId),
    enabled: Boolean(orgId),
  });
}

export function useDeliveryNotes(orgId: string) {
  return useQuery({
    queryKey: invoicesKeys.deliveryNotes(orgId),
    queryFn: () => getDeliveryNotes(orgId),
    enabled: Boolean(orgId),
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: invoicesKeys.quote(id),
    queryFn: () => getQuoteWithItems(id),
    enabled: Boolean(id),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoicesKeys.invoice(id),
    queryFn: () => getInvoiceWithItems(id),
    enabled: Boolean(id),
  });
}

export function useDeliveryNote(id: string) {
  return useQuery({
    queryKey: invoicesKeys.deliveryNote(id),
    queryFn: () => getDeliveryNoteWithItems(id),
    enabled: Boolean(id),
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createQuote,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.quotes(data.orgId) });
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.invoices(data.orgId) });
    },
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.deliveryNotes(data.orgId) });
    },
  });
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      sentAt,
    }: {
      id: string;
      status: Parameters<typeof updateDocumentStatus>[1];
      sentAt?: string | null;
    }) => updateDocumentStatus(id, status, sentAt),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.quote(variables.id) });
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.invoice(variables.id) });
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.deliveryNote(variables.id) });
    },
  });
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: convertQuoteToInvoice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      amount,
      paymentMethod,
      reference,
    }: {
      invoiceId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      reference?: string | null;
    }) => recordPayment(invoiceId, amount, paymentMethod, reference),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.invoice(variables.invoiceId) });
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}

export function useMarkDeliveryNoteDelivered() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markDeliveryNoteDelivered,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}
