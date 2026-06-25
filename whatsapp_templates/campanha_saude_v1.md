# Template HSM: `campanha_saude_v1`

**Status:** Pronto pra submeter na Meta Business Suite
**Onde criar:** https://business.facebook.com/wa/manage/message-templates → "Criar template"
**Conta WhatsApp Business:** (preencher quando criar)

---

## Configuração na Meta

| Campo | Valor |
|---|---|
| **Nome do template** | `campanha_saude_v1` |
| **Categoria** | `UTILITY` (atende notificações operacionais; menor custo que MARKETING) |
| **Idioma** | `pt_BR` (Português - Brasil) |
| **Variáveis no corpo** | 2 (`{{1}}` = nome da campanha, `{{2}}` = mensagem) |

---

## Corpo da mensagem (cola direto no campo "Body")

```
*Saúde do Trabalho — {{1}}*

{{2}}

Acesse pelo app ou link enviado pela sua empresa.

_Você pode encerrar o envio respondendo SAIR._
```

---

## Exemplo de preenchimento (necessário pra submissão)

A Meta exige que você envie um exemplo das variáveis pra revisão. Use:

- `{{1}}` → `Outubro Rosa 2026`
- `{{2}}` → `Convidamos você a participar da campanha de prevenção ao câncer de mama deste mês. Há cartazes, vídeo educativo e uma roda de conversa marcada pra dia 18/10.`

---

## Como o código usa esse template

Em `server/routers.ts > preventiveLibrary.sendCampaignBlast`, ao escolher "WhatsApp" ou "Todos os canais":

```js
sendWhatsappTemplate(phone, "campanha_saude_v1", "pt_BR", [
  String(camp.name),                  // {{1}}
  String(introBody).slice(0, 600),    // {{2}}
])
```

Em **modo PREVIEW** (sem credenciais Meta no `.env`), o helper apenas loga e grava `status='preview'` em `whatsapp_messages`.

Em **PROD**, o template precisa estar APROVADO pela Meta (1-3 dias úteis).

---

## Tempo de aprovação esperado

- Categoria UTILITY com variáveis simples e sem CTA: geralmente **algumas horas a 1 dia**.
- Se a Meta rejeitar (ex.: "categoria errada", "promocional disfarçado de utility"), recategoriza pra MARKETING e re-submete.
