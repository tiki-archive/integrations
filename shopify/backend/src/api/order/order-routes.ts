/*
 * Copyright (c) TIKI Inc.
 * MIT license. See LICENSE file in root directory.
 */

import { IRequest } from 'itty-router';
import { Shopify } from '../../shopify/shopify';
import { OrderReq } from './order-req';
import { Throw, API } from '@mytiki/worker-utils-ts';

export async function paid(request: IRequest, env: Env): Promise<Response> {
  const shop = request.headers.get('X-Shopify-Shop-Domain');
  Throw.ifNull(shop, 'X-Shopify-Shop-Domain');

  const shopify = new Shopify(shop as string, env);
  const success = await shopify.verifyWebhook(request);
  if (!success) {
    throw new API.ErrorBuilder().message('Invalid signature').error(403);
  }

  const order: OrderReq = await request.json();
  // const discounts: Array<string> = [];
  // order.discount_applications.forEach((discount) => {
  //   if (discount.description.startsWith('TID: ')) {
  //     const tid = discount.description.replace('TID: ', '');
  //     discounts.push(tid);
  //   }
  // });
  // await shopify.discountUsed(order.customer.id, discounts);

  return new Response(null, {
    status: 200,
  });
}

// a) is there a license for this customer that lets us ingest data?

// b) is there a discount applied? is this discount a tiki discount? if so, save it to cust. metafield
// find by title, sort by created, take top.
