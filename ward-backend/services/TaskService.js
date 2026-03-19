const taskRepository = require('../repositories/TaskRepository');
const crypto = require('crypto');

const ALLOWED_TASK_TYPES = ['vital', 'assessment', 'followup'];

class TaskService {
  async createTask(patientId, payload, createdBy, tenantId) {
    if (!patientId) throw new Error('Patient ID is required');

    const { type, dueAt, notes } = payload || {};

    if (!type || !ALLOWED_TASK_TYPES.includes(type)) {
      throw new Error('Invalid task type');
    }

    if (!dueAt) {
      throw new Error('Due time is required');
    }

    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) {
      throw new Error('Due time must be a valid date');
    }

    const id = crypto.randomUUID();
    const assignee = createdBy; // default assignment to creator for now
    const tenant = tenantId || 'tenant-default';

    return await taskRepository.create({
      id,
      tenantId: tenant,
      patientId,
      type,
      dueAt: due.toISOString(),
      status: 'open',
      assignee,
      notes,
      createdBy
    });
  }

  async listPatientTasks(patientId, status = 'open', tenantId) {
    if (!patientId) throw new Error('Patient ID is required');
    const tenant = tenantId || 'tenant-default';
    return await taskRepository.listByPatient(patientId, tenant, status);
  }

  async listMyOpenTasks(assignee, tenantId) {
    if (!assignee) throw new Error('Assignee is required');
    return await taskRepository.listMyOpenTasks(assignee, tenantId);
  }

  async completeTask(taskId, completedBy, tenantId) {
    if (!taskId) throw new Error('Task ID is required');
    const changes = await taskRepository.complete(taskId, completedBy, tenantId);
    if (!changes || changes === 0) {
      throw new Error('Task not found');
    }
    return { message: 'Task completed successfully' };
  }
}

module.exports = new TaskService();

