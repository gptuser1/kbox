import { Hono } from 'hono';
import { Bindings, Variables } from './db/db-utils';
import connectionsRouter from './db/db-connections';
import queryRouter from './db/db-query';
import rowsRouter from './db/db-rows';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.route('/connections', connectionsRouter);
app.route('/connections/:id', queryRouter);
app.route('/connections/:id/tables/:table/row', rowsRouter);

export default app;