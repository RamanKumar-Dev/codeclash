import { User, IUser } from '../models/user.model';
import { redisService } from './redis.service';
import { Friend, FriendRequest, OnlineStatus } from '@code-clash/shared-types';
import { v4 as uuidv4 } from 'uuid';

export class FriendService {
  // Send friend request
  async sendFriendRequest(fromUserId: string, toUsername: string): Promise<FriendRequest> {
    try {
      // Find target user
      const targetUser = await User.findByUsername(toUsername);
      if (!targetUser) {
        throw new Error('User not found');
      }

      // Check if users are trying to friend themselves
      if (fromUserId === targetUser.id) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if target user allows friend requests
      if (!targetUser.preferences.allowFriendRequests) {
        throw new Error('User does not accept friend requests');
      }

      // Check if already friends
      const fromUser = await User.findOne({ id: fromUserId });
      if (!fromUser) {
        throw new Error('Sender not found');
      }

      if (fromUser.isFriendWith(targetUser.id)) {
        throw new Error('Already friends with this user');
      }

      // Check if request already exists
      const existingRequest = targetUser.pendingRequests.find(
        r => r.fromUserId === fromUserId
      );
      if (existingRequest) {
        throw new Error('Friend request already sent');
      }

      // Create friend request
      const friendRequest: FriendRequest = {
        id: uuidv4(),
        fromUserId,
        toUserId: targetUser.id,
        fromUsername: fromUser.username,
        toUsername: targetUser.username,
        status: 'pending',
        createdAt: new Date(),
      };

      // Add to target user's pending requests
      await targetUser.sendFriendRequest(fromUserId, fromUser.username);

      // Store request in Redis for real-time notifications
      await redisService.setex(
        `friend_request:${friendRequest.id}`,
        86400, // 24 hours TTL
        JSON.stringify(friendRequest)
      );

      // Publish notification
      await redisService.publish(`friend_request:${targetUser.id}`, friendRequest);

      console.log(`Friend request sent: ${fromUserId} -> ${targetUser.id}`);
      return friendRequest;
    } catch (error) {
      console.error('Error sending friend request:', error);
      throw error;
    }
  }

  // Accept friend request
  async acceptFriendRequest(userId: string, fromUserId: string): Promise<Friend> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      const fromUser = await User.findOne({ id: fromUserId });
      if (!fromUser) {
        throw new Error('Friend request sender not found');
      }

      // Accept the request
      await user.acceptFriendRequest(fromUserId);

      // Add friendship to both users
      const friendshipData = {
        userId: fromUserId,
        username: fromUser.username,
        friendshipStarted: new Date(),
        gamesPlayedTogether: 0,
      };

      user.friends.push(friendshipData);
      await user.save();

      // Add reverse friendship
      const reverseFriendshipData = {
        userId: userId,
        username: user.username,
        friendshipStarted: new Date(),
        gamesPlayedTogether: 0,
      };

      fromUser.friends.push(reverseFriendshipData);
      await fromUser.save();

      // Create friend object for response
      const friend: Friend = {
        userId: fromUserId,
        username: fromUser.username,
        elo: fromUser.elo,
        isOnline: fromUser.isOnline,
        lastSeen: fromUser.lastActive,
        friendshipStarted: friendshipData.friendshipStarted,
        gamesPlayedTogether: 0,
      };

      // Publish acceptance notification
      await redisService.publish(`friend_accepted:${fromUserId}`, friend);

      console.log(`Friend request accepted: ${userId} <-> ${fromUserId}`);
      return friend;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      throw error;
    }
  }

  // Decline friend request
  async declineFriendRequest(userId: string, fromUserId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      await user.declineFriendRequest(fromUserId);

      // Publish decline notification
      await redisService.publish(`friend_declined:${fromUserId}`, {
        fromUserId: userId,
        timestamp: new Date(),
      });

      console.log(`Friend request declined: ${userId} declined ${fromUserId}`);
    } catch (error) {
      console.error('Error declining friend request:', error);
      throw error;
    }
  }

  // Remove friend
  async removeFriend(userId: string, friendUserId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      const friendUser = await User.findOne({ id: friendUserId });
      if (!friendUser) {
        throw new Error('Friend not found');
      }

      // Remove from both users
      await user.removeFriend(friendUserId);
      await friendUser.removeFriend(userId);

      // Publish removal notification
      await redisService.publish(`friend_removed:${friendUserId}`, {
        fromUserId: userId,
        timestamp: new Date(),
      });

      console.log(`Friendship removed: ${userId} <-> ${friendUserId}`);
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  }

  // Block user
  async blockUser(userId: string, blockUserId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      await user.blockUser(blockUserId);

      // Publish block notification
      await redisService.publish(`user_blocked:${blockUserId}`, {
        fromUserId: userId,
        timestamp: new Date(),
      });

      console.log(`User blocked: ${userId} blocked ${blockUserId}`);
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  // Unblock user
  async unblockUser(userId: string, unblockUserId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      await user.unblockUser(unblockUserId);

      console.log(`User unblocked: ${userId} unblocked ${unblockUserId}`);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }

  // Get user's friends
  async getUserFriends(userId: string): Promise<Friend[]> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      const friends: Friend[] = [];

      for (const friendData of user.friends) {
        const friendUser = await User.findOne({ id: friendData.userId });
        if (friendUser) {
          friends.push({
            userId: friendData.userId,
            username: friendUser.username,
            elo: friendUser.elo,
            isOnline: friendUser.isOnline,
            lastSeen: friendUser.lastActive,
            friendshipStarted: friendData.friendshipStarted,
            gamesPlayedTogether: friendData.gamesPlayedTogether,
          });
        }
      }

      return friends.sort((a, b) => {
        // Sort by online status first, then by username
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.username.localeCompare(b.username);
      });
    } catch (error) {
      console.error('Error getting user friends:', error);
      throw error;
    }
  }

  // Get online friends
  async getOnlineFriends(userId: string): Promise<Friend[]> {
    try {
      const allFriends = await this.getUserFriends(userId);
      return allFriends.filter(friend => friend.isOnline);
    } catch (error) {
      console.error('Error getting online friends:', error);
      throw error;
    }
  }

  // Get pending friend requests
  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    try {
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      const requests: FriendRequest[] = [];

      for (const requestData of user.pendingRequests) {
        requests.push({
          id: uuidv4(), // Generate ID for consistency
          fromUserId: requestData.fromUserId,
          toUserId: userId,
          fromUsername: requestData.fromUsername,
          toUsername: user.username,
          status: 'pending',
          createdAt: requestData.createdAt,
        });
      }

      return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting pending requests:', error);
      throw error;
    }
  }

  // Update online status
  async updateOnlineStatus(userId: string, status: OnlineStatus): Promise<void> {
    try {
      // Update in database
      const user = await User.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      await user.updateOnlineStatus(status.status === 'online');

      // Store in Redis with TTL
      await redisService.setex(
        `online:${userId}`,
        30, // 30 seconds TTL
        JSON.stringify({
          status: status.status,
          lastHeartbeat: status.lastHeartbeat,
          currentBattleId: status.currentBattleId,
        })
      );

      // Publish status update to friends
      const friends = await this.getUserFriends(userId);
      for (const friend of friends) {
        await redisService.publish(`friend_status:${friend.userId}`, {
          userId,
          status,
        });
      }

      console.log(`Online status updated for ${userId}: ${status.status}`);
    } catch (error) {
      console.error('Error updating online status:', error);
      throw error;
    }
  }

  // Check if user is online
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const onlineData = await redisService.client.get(`online:${userId}`);
      return !!onlineData;
    } catch (error) {
      console.error('Error checking online status:', error);
      return false;
    }
  }

  // Get user's online status
  async getUserOnlineStatus(userId: string): Promise<OnlineStatus | null> {
    try {
      const onlineData = await redisService.client.get(`online:${userId}`);
      if (!onlineData) {
        return null;
      }

      const data = JSON.parse(onlineData);
      return {
        userId,
        status: data.status,
        lastHeartbeat: new Date(data.lastHeartbeat),
        currentBattleId: data.currentBattleId,
      };
    } catch (error) {
      console.error('Error getting user online status:', error);
      return null;
    }
  }

  // Search for users
  async searchUsers(query: string, currentUserId: string, limit = 20): Promise<any[]> {
    try {
      const users = await User.searchUsers(query, limit);
      
      return users.map(user => ({
        id: user.id,
        username: user.username,
        elo: user.elo,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        isFriend: user.friends.some(f => f.userId === currentUserId),
        hasPendingRequest: user.pendingRequests.some(r => r.fromUserId === currentUserId),
        isBlocked: user.blockedUsers.includes(currentUserId),
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Get friend suggestions
  async getFriendSuggestions(userId: string, limit = 10): Promise<any[]> {
    try {
      const users = await User.getFriendSuggestions(userId, limit);
      
      return users.map(user => ({
        id: user.id,
        username: user.username,
        elo: user.elo,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
      }));
    } catch (error) {
      console.error('Error getting friend suggestions:', error);
      throw error;
    }
  }

  // Update games played together
  async updateGamesPlayedTogether(userId1: string, userId2: string): Promise<void> {
    try {
      const user1 = await User.findOne({ id: userId1 });
      const user2 = await User.findOne({ id: userId2 });

      if (user1 && user2) {
        // Update for user1
        const friendIndex1 = user1.friends.findIndex(f => f.userId === userId2);
        if (friendIndex1 !== -1) {
          user1.friends[friendIndex1].gamesPlayedTogether++;
          await user1.save();
        }

        // Update for user2
        const friendIndex2 = user2.friends.findIndex(f => f.userId === userId1);
        if (friendIndex2 !== -1) {
          user2.friends[friendIndex2].gamesPlayedTogether++;
          await user2.save();
        }

        console.log(`Updated games played together for ${userId1} and ${userId2}`);
      }
    } catch (error) {
      console.error('Error updating games played together:', error);
    }
  }

  // Cleanup expired friend requests
  async cleanupExpiredRequests(): Promise<void> {
    try {
      const users = await User.find({
        'pendingRequests.0': { $exists: true },
      });

      for (const user of users) {
        const validRequests = user.pendingRequests.filter(request => {
          const age = Date.now() - request.createdAt.getTime();
          return age < 7 * 24 * 60 * 60 * 1000; // 7 days
        });

        if (validRequests.length !== user.pendingRequests.length) {
          user.pendingRequests = validRequests;
          await user.save();
        }
      }

      console.log('Cleaned up expired friend requests');
    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
    }
  }
}

export const friendService = new FriendService();
