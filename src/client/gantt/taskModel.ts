import { TaskModel } from '@bryntum/gantt'

export class CadenceTaskModel extends TaskModel {
  static $name = 'CadenceTaskModel'

  static get fields() {
    return [
      { name: 'status', defaultValue: 'proposed' },
      { name: 'owner', defaultValue: '' },
      { name: 'outcome', defaultValue: '' },
      { name: 'manuallyScheduled', defaultValue: true },
    ]
  }
}
