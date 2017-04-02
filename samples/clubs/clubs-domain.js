import * as R from 'ramda'

export default {
  root: 'clubs',
  types: {
    clubs: {
      hasMany: {
        ordinaryMembers: {
          of: 'members',
          foreignKey: 'clubIdOrdinaryMember'
        },
        vipMembers: {
          of: 'members',
          foreignKey: 'clubIdVipMember'
        }
      },
      derivedProps: {
        members: {
          f: self => R.concat(self.ordinaryMembers.get(), self.vipMembers.get())
        },
        numMembers: {
          f: self => self.members.get().length
        }
      }
    },
    members: {}
  }
}
