import React from 'react';

/**
 * Caixa de erro de transação usada nas telas de depósito e saque.
 * (O formulário de bills usa uma caixa de erro com estilo próprio.)
 */
export function TxErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        background: 'rgba(220,50,50,.08)',
        border: '1px solid rgba(220,50,50,.25)',
        borderRadius: 'var(--fx-radius-md)',
        fontFamily: 'var(--fx-font-mono)',
        fontSize: 13,
        color: '#ff6b6b',
      }}
    >
      {message}
    </div>
  );
}
