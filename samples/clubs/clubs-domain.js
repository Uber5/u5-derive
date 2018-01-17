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
          f: self => R.concat(
            self.ordinaryMembers.get().map(m => m._id),
            self.vipMembers.get().map(m => m._id)
          )
        },
        numMembers: {
          f: self => self.members.get().length
        }
      }
    },
    // TODO: the below is just to check if we can have a ref back / reverse association
    // ... previously this resulted in an endless loop. Oops.
    members: {
      hasOne: {
        club: {
          of: 'clubs',
          foreignKey: 'clubIdOrdinaryMember'
        }
      },
      derivedProps: {
        numClubMembers: {
          f: self => {
            const club = self.club.get()
            return club ? club.numMembers.get() : 0
          }
        }
      }
    }
  }
}
