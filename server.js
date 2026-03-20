import express from 'express';
import Database from 'better-sqlite3';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).send({'message': 'SHIPTIVITY API. Read documentation to see API docs'});
});

const db = new Database('./clients.db');


const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

/**
 * Validate id input
 * @param {any} id
 */
const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
}

/**
 * Validate priority input
 * @param {any} priority
 */
const validatePriority = (priority) => {
  if (Number.isNaN(priority)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid priority provided.',
      'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  }
}

/**
 * Get all of the clients. Optional filter 'status'
 * GET /api/v1/clients?status={status}
 */
app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ? order by priority').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients order by priority');
  const clients = statement.all();
  return res.status(200).send(clients);
});

/**
 * Get a client based on the id provided.
 * GET /api/v1/clients/{client_id}
 */
app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    return res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});


app.put('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    return res.status(400).send(messageObj);
  }

  let { status, priority } = req.body;
  const client = db.prepare('select * from clients where id = ?').get(id);

  const targetStatus = status || client.status;
  const targetPriority = priority || client.priority;

  if (targetStatus === client.status) {
    if (targetPriority < client.priority) {
      db.prepare('UPDATE clients SET priority = priority + 1 WHERE status = ? AND priority >= ? AND priority < ? AND id != ?')
        .run(targetStatus, targetPriority, client.priority, id);
    } else if (targetPriority > client.priority) {
     
      db.prepare('UPDATE clients SET priority = priority - 1 WHERE status = ? AND priority <= ? AND priority > ? AND id != ?')
        .run(targetStatus, targetPriority, client.priority, id);
    }
  } else {
   
    db.prepare('UPDATE clients SET priority = priority - 1 WHERE status = ? AND priority > ?')
      .run(client.status, client.priority);

    
    db.prepare('UPDATE clients SET priority = priority + 1 WHERE status = ? AND priority >= ?')
      .run(targetStatus, targetPriority);
  }

  db.prepare('UPDATE clients SET status = ?, priority = ? WHERE id = ?')
    .run(targetStatus, targetPriority, id);

  const allClients = db.prepare('select * from clients order by priority').all();
  return res.status(200).send(allClients);
});

app.listen(3001);
console.log('app running on port ', 3001);