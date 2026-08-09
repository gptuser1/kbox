import { Hono } from 'hono';
import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';
import { Bindings, Variables } from './utils';
import connectionsRouter from './connections';
import queryRouter from './query';
import rowsRouter from './rows';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.route('/connections', connectionsRouter);
app.route('/connections/:id', queryRouter);
app.route('/connections/:id/tables/:table/row', rowsRouter);

const dbAdminPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default dbAdminPlugin;