/*
 * Copyright (c) TIKI Inc.
 * MIT license. See LICENSE file in root directory.
 */

import { Shopify } from '../../shopify/shopify';
import { Tiki } from '../../tiki/tiki';
import { API } from '@mytiki/worker-utils-ts';
import { IRequest } from 'itty-router';

export async function authorize(
  request: IRequest,
  env: Env
): Promise<Response> {
  const shop = request.query.shop as string;
  const baseUrl = new URL(request.url).hostname;
  if (shop == null) {
    throw new API.ErrorBuilder()
      .message('Missing required parameters.')
      .detail('Requires shop.')
      .error(404);
  }
  const shopify = new Shopify(shop, env);
  await shopify.verifyOAuth(request);
  const authUrl = shopify.authorize(
    `https://${baseUrl}/api/latest/oauth/token`
  );
  return new Response(null, {
    status: 302,
    headers: new Headers({
      location: authUrl,
    }),
  });
}

export async function token(request: IRequest, env: Env): Promise<Response> {
  const shop = request.query.shop as string;
  const code = request.query.code as string;
  const baseUrl = new URL(request.url).hostname;
  if (shop == null || code == null) {
    throw new API.ErrorBuilder()
      .message('Missing required parameters.')
      .detail('Requires shop. Requires code.')
      .error(404);
  }

  const shopify = new Shopify(shop, env);
  await shopify.grant(code);
  const appInstallation = await shopify.getInstall();
  const keys = appInstallation.data.currentAppInstallation.metafields?.nodes;
  if (keys === undefined || keys.length < 3) {
    await onInstall(
      new Tiki(env),
      shopify,
      appInstallation.data.currentAppInstallation.id,
      baseUrl
    );
  }

  return new Response(null, {
    status: 302,
    headers: new Headers({
      location: `https://${shop}/apps/${env.KEY_ID}`,
    }),
  });
}

async function onInstall(
  tiki: Tiki,
  shopify: Shopify,
  installId: string,
  baseUrl: string
): Promise<void> {
  const shopifyAccessToken = await shopify.getToken();
  const tikiAccessToken = await tiki.login(
    shopify.shopDomain,
    shopifyAccessToken
  );
  const tikiApp = await tiki.createApp(tikiAccessToken, shopify.shopDomain);
  const tikiPublicKey = await tiki.createKey(
    tikiAccessToken,
    tikiApp.appId,
    true
  );
  const tikiPrivateKey = await tiki.createKey(
    tikiAccessToken,
    tikiApp.appId,
    false
  );
  await shopify.saveKeys(installId, tikiPublicKey, tikiPrivateKey);
  await shopify.registerOrderPaidWebhook(baseUrl);
}
