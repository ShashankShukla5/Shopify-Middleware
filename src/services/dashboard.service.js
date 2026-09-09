const { prisma } = require('../db/prisma');
const { config } = require('../config');
const { AppError } = require('../errors/AppError');
const { toMoneyNumber } = require('../utils/moneySerialize');
const {
  buildOrderWhere,
  parsePagination,
  resolveOrderNumber,
} = require('../utils/dashboardQuery');
const {
  PAID_EARNINGS_STATUSES,
  PENDING_EARNINGS_STATUSES,
} = require('../utils/earningsClassification');
const { rowsToCsv } = require('../utils/csv');

function mapOrderListItem(order) {
  return {
    id: order.id,
    orderNumber: resolveOrderNumber(order),
    date: order.createdAt,
    clientEmail: order.clientEmail,
    currency: order.currency,
    baseTotal: toMoneyNumber(order.baseTotal),
    markupTotal: toMoneyNumber(order.markupTotal),
    finalTotal: toMoneyNumber(order.finalTotal),
    paymentStatus: order.paymentStatus,
    invoiceSent: order.invoiceSent,
    invoiceSentAt: order.invoiceSentAt,
    paidAt: order.paidAt,
    items: (order.items || []).map((item) => ({
      productTitle: item.productTitle,
      sku: item.sku,
      quantity: item.quantity,
      markupTotal: toMoneyNumber(item.markupTotal),
      finalLineTotal: toMoneyNumber(item.finalLineTotal),
    })),
  };
}

async function getDashboardSummary(practitionerId, query = {}) {
  const where = buildOrderWhere({
    practitionerId,
    from: query.from,
    to: query.to,
  });

  const [totalOrders, totals, paidAgg, pendingAgg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where,
      _sum: {
        finalTotal: true,
        markupTotal: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        ...where,
        paymentStatus: { in: PAID_EARNINGS_STATUSES },
      },
      _sum: {
        markupTotal: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        ...where,
        paymentStatus: { in: PENDING_EARNINGS_STATUSES },
      },
      _sum: {
        markupTotal: true,
      },
    }),
  ]);

  return {
    totalOrders,
    totalSales: toMoneyNumber(totals._sum.finalTotal),
    totalMarkup: toMoneyNumber(totals._sum.markupTotal),
    pendingEarnings: toMoneyNumber(pendingAgg._sum.markupTotal),
    paidEarnings: toMoneyNumber(paidAgg._sum.markupTotal),
    currency: config.draftOrder.currencyCode || 'AUD',
  };
}

async function listDashboardOrders(practitionerId, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const where = buildOrderWhere({
    practitionerId,
    from: query.from,
    to: query.to,
    status: query.status,
    search: query.search,
  });

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        shopifyOrderName: true,
        shopifyDraftOrderName: true,
        createdAt: true,
        clientEmail: true,
        currency: true,
        baseTotal: true,
        markupTotal: true,
        finalTotal: true,
        paymentStatus: true,
        invoiceSent: true,
        invoiceSentAt: true,
        paidAt: true,
        items: {
          select: {
            productTitle: true,
            sku: true,
            quantity: true,
            markupTotal: true,
            finalLineTotal: true,
          },
        },
      },
    }),
  ]);

  return {
    orders: orders.map(mapOrderListItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getDashboardOrderDetail(practitionerId, orderId) {
  if (!orderId) {
    throw new AppError('Order id is required', 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      practitionerId,
    },
    select: {
      id: true,
      shopifyOrderName: true,
      shopifyDraftOrderName: true,
      createdAt: true,
      clientEmail: true,
      currency: true,
      baseTotal: true,
      markupTotal: true,
      finalTotal: true,
      paymentStatus: true,
      invoiceSent: true,
      invoiceSentAt: true,
      paidAt: true,
      items: {
        select: {
          productTitle: true,
          sku: true,
          shopifyProductId: true,
          shopifyVariantId: true,
          quantity: true,
          baseUnitPrice: true,
          markupPerUnit: true,
          markupTotal: true,
          finalUnitPrice: true,
          finalLineTotal: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return {
    id: order.id,
    orderNumber: resolveOrderNumber(order),
    draftOrderNumber: order.shopifyDraftOrderName || null,
    date: order.createdAt,
    clientEmail: order.clientEmail,
    currency: order.currency,
    baseTotal: toMoneyNumber(order.baseTotal),
    markupTotal: toMoneyNumber(order.markupTotal),
    finalTotal: toMoneyNumber(order.finalTotal),
    paymentStatus: order.paymentStatus,
    invoiceSent: order.invoiceSent,
    invoiceSentAt: order.invoiceSentAt,
    paidAt: order.paidAt,
    items: order.items.map((item) => ({
      productTitle: item.productTitle,
      sku: item.sku,
      shopifyProductId: item.shopifyProductId,
      shopifyVariantId: item.shopifyVariantId,
      quantity: item.quantity,
      baseUnitPrice: toMoneyNumber(item.baseUnitPrice),
      markupPerUnit: toMoneyNumber(item.markupPerUnit),
      markupTotal: toMoneyNumber(item.markupTotal),
      finalUnitPrice: toMoneyNumber(item.finalUnitPrice),
      finalLineTotal: toMoneyNumber(item.finalLineTotal),
    })),
  };
}

async function buildEarningsCsv(practitionerId, query = {}) {
  const where = buildOrderWhere({
    practitionerId,
    from: query.from,
    to: query.to,
    status: query.status,
  });

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      shopifyOrderName: true,
      shopifyDraftOrderName: true,
      createdAt: true,
      clientEmail: true,
      currency: true,
      finalTotal: true,
      paymentStatus: true,
      invoiceSent: true,
      paidAt: true,
      items: {
        select: {
          productTitle: true,
          sku: true,
          quantity: true,
          baseUnitPrice: true,
          markupPerUnit: true,
          markupTotal: true,
          finalUnitPrice: true,
          finalLineTotal: true,
        },
      },
    },
  });

  const headers = [
    'Order Date',
    'Order Number',
    'Client Email',
    'Product',
    'SKU',
    'Quantity',
    'Base Unit Price',
    'Markup Per Unit',
    'Markup Total',
    'Final Unit Price',
    'Final Line Total',
    'Order Total',
    'Currency',
    'Payment Status',
    'Invoice Sent',
    'Paid Date',
  ];

  const rows = [];
  for (const order of orders) {
    const orderNumber = resolveOrderNumber(order);
    const orderDate = order.createdAt.toISOString();
    const paidDate = order.paidAt ? order.paidAt.toISOString() : '';
    const invoiceSentLabel = order.invoiceSent ? 'Yes' : 'No';

    if (!order.items.length) {
      rows.push({
        'Order Date': orderDate,
        'Order Number': orderNumber,
        'Client Email': order.clientEmail || '',
        Product: '',
        SKU: '',
        Quantity: '',
        'Base Unit Price': '',
        'Markup Per Unit': '',
        'Markup Total': '',
        'Final Unit Price': '',
        'Final Line Total': '',
        'Order Total': toMoneyNumber(order.finalTotal),
        Currency: order.currency,
        'Payment Status': order.paymentStatus,
        'Invoice Sent': invoiceSentLabel,
        'Paid Date': paidDate,
      });
      continue;
    }

    for (const item of order.items) {
      rows.push({
        'Order Date': orderDate,
        'Order Number': orderNumber,
        'Client Email': order.clientEmail || '',
        Product: item.productTitle || '',
        SKU: item.sku || '',
        Quantity: item.quantity,
        'Base Unit Price': toMoneyNumber(item.baseUnitPrice),
        'Markup Per Unit': toMoneyNumber(item.markupPerUnit),
        'Markup Total': toMoneyNumber(item.markupTotal),
        'Final Unit Price': toMoneyNumber(item.finalUnitPrice),
        'Final Line Total': toMoneyNumber(item.finalLineTotal),
        'Order Total': toMoneyNumber(order.finalTotal),
        Currency: order.currency,
        'Payment Status': order.paymentStatus,
        'Invoice Sent': invoiceSentLabel,
        'Paid Date': paidDate,
      });
    }
  }

  return rowsToCsv(headers, rows);
}

module.exports = {
  getDashboardSummary,
  listDashboardOrders,
  getDashboardOrderDetail,
  buildEarningsCsv,
};
