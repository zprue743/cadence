import { TaskModel } from '@bryntum/gantt'

export class CadenceTaskModel extends TaskModel {
  static $name = 'CadenceTaskModel'

  static get fields() {
    return [
      { name: 'status', defaultValue: 'proposed' },
      { name: 'owner', defaultValue: '' },
      { name: 'outcome', defaultValue: '' },
      { name: 'successCriteria', defaultValue: '' },
      { name: 'gitlabUrl', defaultValue: '' },
      { name: 'manuallyScheduled', defaultValue: true },
      { name: 'dateHealth', persist: false, defaultValue: '' },
      { name: 'targetDate', persist: false, defaultValue: '' },
      { name: 'teamName', persist: false, defaultValue: '' },
      { name: 'rollup', persist: false, defaultValue: false },
    ]
  }
}
