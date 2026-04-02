import { test, expect } from '@playwright/test';

test.describe('Code-Clash Battle Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
  });

  test('complete battle flow from login to victory', async ({ page }) => {
    // 1. Login
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    // Wait for navigation to lobby
    await expect(page.locator('[data-testid=lobby-container]')).toBeVisible();
    
    // 2. Join matchmaking queue
    await page.click('[data-testid=find-match-button]');
    await expect(page.locator('[data-testid=queue-status]')).toContainText('In Queue');
    
    // 3. Wait for match to be found (mock or test environment)
    await page.waitForSelector('[data-testid=battle-room]', { timeout: 30000 });
    
    // 4. Battle preparation
    await expect(page.locator('[data-testid=opponent-info]')).toBeVisible();
    await expect(page.locator('[data-testid=puzzle-description]')).toBeVisible();
    
    // 5. Ready up for battle
    await page.click('[data-testid=ready-button]');
    await expect(page.locator('[data-testid=battle-timer]')).toBeVisible();
    
    // 6. Submit code solution
    const codeEditor = page.locator('[data-testid=code-editor]');
    await codeEditor.fill(`
def solve():
    return "Hello World"
`);
    
    await page.click('[data-testid=submit-code-button]');
    
    // 7. Wait for execution results
    await expect(page.locator('[data-testid=execution-result]')).toBeVisible({ timeout: 10000 });
    
    // 8. Verify damage was dealt
    await expect(page.locator('[data-testid=opponent-health]')).not.toHaveText('100 HP');
    
    // 9. Continue battle until victory (in test, simulate win)
    await page.click('[data-testid=submit-code-button]');
    await page.waitForSelector('[data-testid=victory-screen]', { timeout: 15000 });
    
    // 10. Verify victory screen
    await expect(page.locator('[data-testid=victory-screen]')).toBeVisible();
    await expect(page.locator('[data-testid=winner-info]')).toContainText('testuser');
    
    // 11. Return to lobby
    await page.click('[data-testid=return-to-lobby-button]');
    await expect(page.locator('[data-testid=lobby-container]')).toBeVisible();
  });

  test('matchmaking and battle room functionality', async ({ page }) => {
    // Login
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    // Test matchmaking queue
    await page.click('[data-testid=find-match-button]');
    await expect(page.locator('[data-testid=queue-status]')).toContainText('In Queue');
    
    // Test leaving queue
    await page.click('[data-testid=leave-queue-button]');
    await expect(page.locator('[data-testid=queue-status]')).toContainText('Not in Queue');
  });

  test('code editor functionality', async ({ page }) => {
    // Login and join battle
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    await page.click('[data-testid=find-match-button]');
    await page.waitForSelector('[data-testid=battle-room]', { timeout: 30000 });
    await page.click('[data-testid=ready-button]');
    
    // Test code editor features
    const codeEditor = page.locator('[data-testid=code-editor]');
    await expect(codeEditor).toBeVisible();
    
    // Test language selection
    await page.selectOption('[data-testid=language-selector]', 'python');
    await expect(page.locator('[data-testid=language-selector]')).toHaveValue('python');
    
    // Test code submission
    await codeEditor.fill('print("Hello World")');
    await page.click('[data-testid=submit-code-button]');
    
    // Verify submission was processed
    await expect(page.locator('[data-testid=execution-result]')).toBeVisible({ timeout: 10000 });
  });

  test('real-time battle updates', async ({ page, context }) => {
    // Create two pages for two players
    const page2 = await context.newPage();
    
    // Login both players
    await page.goto('http://localhost:3000');
    await page.fill('[data-testid=username-input]', 'player1');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    await page2.goto('http://localhost:3000');
    await page2.fill('[data-testid=username-input]', 'player2');
    await page2.fill('[data-testid=password-input]', 'testpassword');
    await page2.click('[data-testid=login-button]');
    
    // Both players join queue
    await Promise.all([
      page.click('[data-testid=find-match-button]'),
      page2.click('[data-testid=find-match-button]')
    ]);
    
    // Wait for battle room
    await Promise.all([
      page.waitForSelector('[data-testid=battle-room]'),
      page2.waitForSelector('[data-testid=battle-room]')
    ]);
    
    // Both players ready up
    await Promise.all([
      page.click('[data-testid=ready-button]'),
      page2.click('[data-testid=ready-button]')
    ]);
    
    // Verify both players see each other
    await expect(page.locator('[data-testid=opponent-info]')).toContainText('player2');
    await expect(page2.locator('[data-testid=opponent-info]')).toContainText('player1');
    
    // Player 1 submits code
    await page.fill('[data-testid=code-editor]', 'print("Player 1 solution")');
    await page.click('[data-testid=submit-code-button]');
    
    // Verify player 2 sees the damage
    await expect(page2.locator('[data-testid=opponent-health]')).not.toHaveText('100 HP');
    
    await page2.close();
  });

  test('leaderboard and stats', async ({ page }) => {
    // Login
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    // Navigate to leaderboard
    await page.click('[data-testid=leaderboard-tab]');
    await expect(page.locator('[data-testid=leaderboard-container]')).toBeVisible();
    
    // Verify leaderboard data
    await expect(page.locator('[data-testid=leaderboard-entries]')).toBeVisible();
    
    // Test user profile
    await page.click('[data-testid=profile-tab]');
    await expect(page.locator('[data-testid=user-stats]')).toBeVisible();
    await expect(page.locator('[data-testid=user-elo]')).toBeVisible();
  });

  test('error handling and validation', async ({ page }) => {
    // Test invalid login
    await page.goto('http://localhost:3000');
    await page.fill('[data-testid=username-input]', 'invaliduser');
    await page.fill('[data-testid=password-input]', 'wrongpassword');
    await page.click('[data-testid=login-button]');
    
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('Invalid credentials');
    
    // Test empty code submission
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=password-input]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    await page.click('[data-testid=find-match-button]');
    await page.waitForSelector('[data-testid=battle-room]', { timeout: 30000 });
    await page.click('[data-testid=ready-button]');
    
    // Try to submit empty code
    await page.click('[data-testid=submit-code-button]');
    await expect(page.locator('[data-testid=validation-error]')).toBeVisible();
  });
});
