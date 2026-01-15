/**
 * 早期用户奖励脚本
 * 给所有现有用户充100积分，并发送邮件通知
 * 邮件中包含链接，用户点击后可额外领取50积分
 * 
 * 使用方法：
 * node scripts/award_early_user_credits.js
 * 
 * 环境变量：
 * - SUPABASE_URL: Supabase 项目 URL
 * - SUPABASE_SERVICE_KEY: Supabase 服务密钥
 * - FRONTEND_URL: 前端URL（用于生成邮件链接，默认: http://localhost:3000）
 * - SMTP_HOST: SMTP 服务器地址（可选，如果不设置则只发放积分不发送邮件）
 * - SMTP_PORT: SMTP 端口（可选）
 * - SMTP_USER: SMTP 用户名（可选）
 * - SMTP_PASS: SMTP 密码（可选）
 * - SMTP_FROM: 发件人邮箱（可选）
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const config = require('../src/config');
const DatabaseService = require('../src/services/database');
const logger = require('../src/utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// 邮件发送函数（使用 Supabase 的邮件功能或 SMTP）
async function sendEmail(to, subject, html) {
  try {
    // 方法1: 使用 nodemailer（如果已安装并配置）
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        
        const mailOptions = {
          from: process.env.SMTP_FROM || 'noreply@edunest.app',
          to: to,
          subject: subject,
          html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`邮件发送成功: ${to}`, { messageId: info.messageId });
        return { success: true, messageId: info.messageId };
      } catch (nodemailerError) {
        logger.warn(`nodemailer 不可用，跳过邮件发送: ${to}`, nodemailerError.message);
        return { success: false, error: 'nodemailer not available', skip: true };
      }
    }
    
    // 方法2: 使用 Supabase Edge Functions 发送邮件（如果已配置）
    // 示例：调用 Supabase Edge Function
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        
        // 调用 Edge Function（需要先创建）
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: { to, subject, html }
        });
        
        if (error) throw error;
        
        logger.info(`邮件发送成功（Edge Function）: ${to}`);
        return { success: true, messageId: data?.messageId || 'edge-function' };
      } catch (edgeFunctionError) {
        logger.warn(`Edge Function 不可用，跳过邮件发送: ${to}`, edgeFunctionError.message);
        return { success: false, error: 'edge function not available', skip: true };
      }
    }
    
    // 方法3: 如果没有配置邮件服务，只记录日志（用于后续手动发送）
    logger.info(`邮件发送（记录日志，需要手动发送）: ${to}`, { 
      subject, 
      email: to,
      note: '请手动发送邮件或配置 SMTP/Edge Function'
    });
    return { success: true, messageId: 'logged', skip: true };
    
  } catch (error) {
    logger.error(`邮件发送失败: ${to}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 主函数：发放早期用户奖励
 */
async function awardEarlyUserCredits() {
  try {
    logger.info('开始发放早期用户奖励...');
    
    // 1. 获取所有用户
    const { data: users, error: usersError } = await DatabaseService.getAllUsers();
    
    if (usersError) {
      throw new Error(`获取用户列表失败: ${usersError.message}`);
    }
    
    if (!users || users.length === 0) {
      logger.warn('没有找到用户');
      return;
    }
    
    logger.info(`找到 ${users.length} 个用户`);
    
    // 2. 检查并发放积分
    const CREDITS_AMOUNT = 100; // 初始奖励100积分
    const BONUS_CREDITS_AMOUNT = 50; // 链接点击后额外50积分
    const CHANGE_TYPE = 'early_user';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    let awardedCount = 0;
    let skippedCount = 0;
    let emailSentCount = 0;
    let emailFailedCount = 0;
    
    for (const user of users) {
      try {
        // 检查是否已经发放过
        const { data: existingCredits } = await DatabaseService.getCreditsHistory(user.id, 10, 0);
        const hasEarlyUserCredit = existingCredits && existingCredits.some(
          credit => credit.change_type === CHANGE_TYPE
        );
        
        if (hasEarlyUserCredit) {
          logger.info(`用户 ${user.email} 已获得早期用户奖励，跳过`);
          skippedCount++;
          continue;
        }
        
        // 发放积分
        const { error: creditError } = await DatabaseService.addCreditChange(
          user.id,
          CHANGE_TYPE,
          CREDITS_AMOUNT
        );
        
        if (creditError) {
          logger.error(`发放积分失败: user_id=${user.id}, email=${user.email}`, creditError);
          continue;
        }
        
        logger.info(`✅ 发放积分成功: user_id=${user.id}, email=${user.email}, credits=${CREDITS_AMOUNT}`);
        awardedCount++;
        
        // 3. 生成奖励链接token（用于额外50积分）
        const bonusToken = jwt.sign(
          { 
            userId: user.id, 
            type: 'early_user_bonus',
            timestamp: Date.now()
          },
          config.JWT_SECRET || 'dev-secret-key',
          { expiresIn: '30d' } // 30天有效期
        );
        const bonusLink = `${FRONTEND_URL}/claim-bonus?token=${bonusToken}`;
        
        // 4. 发送邮件通知（如果有邮箱）
        if (user.email) {
          const emailSubject = 'EduNest AI Beta Release - Early User Reward';
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .credits-badge { background-color: #10B981; color: white; padding: 10px 20px; border-radius: 6px; display: inline-block; margin: 20px 0; font-size: 24px; font-weight: bold; }
                .bonus-link { background-color: #4F46E5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-size: 16px; font-weight: bold; }
                .bonus-link:hover { background-color: #4338CA; }
                .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>EduNest AI</h1>
                </div>
                <div class="content">
                  <p>Dear early user,</p>
                  <p>It's our pleasure to have you trying our system. EduNest AI has released our beta version.</p>
                  <p>At the same time we offer each user <span class="credits-badge">100 credits</span> to your account.</p>
                  <p style="margin-top: 30px;">🎁 <strong>Bonus Offer:</strong> Click the link below to claim an additional <strong>50 credits</strong>!</p>
                  <p style="text-align: center;">
                    <a href="${bonusLink}" class="bonus-link">Claim 50 Bonus Credits</a>
                  </p>
                  <p>Thank you for being part of our journey!</p>
                  <p>Kind regards,<br>EduNest AI Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
          const emailResult = await sendEmail(user.email, emailSubject, emailHtml);
          if (emailResult.success) {
            emailSentCount++;
          } else {
            emailFailedCount++;
            logger.warn(`邮件发送失败: ${user.email}`, emailResult.error);
          }
        }
        
        // 添加小延迟，避免过快请求
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (userError) {
        logger.error(`处理用户失败: user_id=${user.id}, email=${user.email}`, userError);
        continue;
      }
    }
    
    // 4. 输出统计结果
    logger.info('='.repeat(50));
    logger.info('早期用户奖励发放完成');
    logger.info(`总用户数: ${users.length}`);
    logger.info(`成功发放: ${awardedCount} 人`);
    logger.info(`跳过（已发放）: ${skippedCount} 人`);
    logger.info(`邮件发送成功: ${emailSentCount} 封`);
    logger.info(`邮件发送失败: ${emailFailedCount} 封`);
    logger.info('='.repeat(50));
    
  } catch (error) {
    logger.error('发放早期用户奖励失败', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  awardEarlyUserCredits()
    .then(() => {
      logger.info('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('脚本执行失败', error);
      process.exit(1);
    });
}

module.exports = { awardEarlyUserCredits, sendEmail };
