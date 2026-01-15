/**
 * 早期用户奖励脚本
 * 给所有现有用户充100积分，并发送邮件通知
 * 邮件中包含链接，用户点击后可额外领取50积分
 * 
 * 使用方法：
 * node scripts/award_early_user_credits.js [userId] [--test-email] [--force-email]
 * 
 * 参数：
 * - userId: 可选，指定用户ID（如果提供，只处理该用户）
 * - --test-email: 可选，只生成邮件内容并保存为HTML文件，不发送邮件
 * - --force-email: 可选，强制发送邮件，即使用户已有 early_user 积分（用于补发邮件）
 * 
 * 环境变量：
 * - SUPABASE_URL: Supabase 项目 URL
 * - SUPABASE_SERVICE_KEY: Supabase 服务密钥
 * 注意：脚本硬编码使用生产环境 URL (https://edunest.app) 生成邮件链接
 * - EMAIL_HOST: 邮件服务器地址（可选，如果不设置则只发放积分不发送邮件）
 * - EMAIL_PORT: 邮件服务器端口（可选，默认: 587）
 * - EMAIL_USERNAME: 邮件用户名（可选，同时作为发件人邮箱）
 * - EMAIL_PASSWORD: 邮件密码（可选）
 */

// 加载 .env 文件（支持多个可能的路径）
const path = require('path');
const envPaths = [
  path.resolve(__dirname, '../../.env'),  // edu/.env
  path.resolve(__dirname, '../../../.env'), // cursor/.env
  path.resolve(process.cwd(), '.env')       // 当前工作目录
];

let envLoaded = false;
const fs = require('fs');
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath, override: true });
      if (process.env.EMAIL_HOST || process.env.SUPABASE_URL) {
        envLoaded = true;
        break;
      }
    }
  } catch (e) {
    // 继续尝试下一个路径
  }
}
// 诊断：检查环境变量加载情况
if (process.env.NODE_ENV !== 'production') {
  const emailVars = Object.keys(process.env).filter(k => k.includes('EMAIL') || k.includes('SMTP'));
  if (emailVars.length > 0) {
    console.log('📧 找到的邮件相关环境变量:', emailVars.join(', '));
  } else {
    console.log('⚠️  未找到 EMAIL_* 或 SMTP_* 环境变量');
    console.log('   请检查 .env 文件中是否包含: EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD');
  }
}

const config = require('../src/config');
const DatabaseService = require('../src/services/database');
const logger = require('../src/utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// fs 和 path 已在上面声明，不需要重复声明

// 邮件发送函数（使用 Supabase 的邮件功能或 SMTP）
async function sendEmail(to, subject, html) {
  try {
    // 使用 EMAIL_* 环境变量，如果没有则使用硬编码默认值
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT || '587';
    const emailUser = process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASSWORD;
    
    // 方法1: 使用 nodemailer（如果已安装并配置）
    if (emailHost && emailUser && emailPass) {
      try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
          host: emailHost,
          port: parseInt(emailPort || '587'),
          secure: emailPort === '465' || emailPort === '994',
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });
        
        const mailOptions = {
          from: emailUser, // 使用 EMAIL_USERNAME 作为发件人
          to: to,
          subject: subject,
          html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`邮件发送成功: ${to}`, { messageId: info.messageId });
        return { success: true, messageId: info.messageId };
      } catch (nodemailerError) {
        logger.error(`nodemailer 发送失败: ${to}`, {
          error: nodemailerError.message,
          code: nodemailerError.code,
          response: nodemailerError.response,
          responseCode: nodemailerError.responseCode,
          command: nodemailerError.command,
          stack: nodemailerError.stack
        });
        return { success: false, error: nodemailerError.message, details: nodemailerError };
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
 * 生成邮件HTML内容
 */
function generateEmailHtml(bonusLink) {
  return `
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
        .bonus-link { background-color: #FFFFFF; color: #DC2626; border: 2px solid #DC2626; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-size: 16px; font-weight: bold; }
        .bonus-link:hover { background-color: #FEE2E2; border-color: #B91C1C; color: #B91C1C; }
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
}

/**
 * 主函数：发放早期用户奖励
 */
async function awardEarlyUserCredits(specificUserId = null, testEmailOnly = false, forceSendEmail = false) {
  try {
    logger.info('='.repeat(70));
    logger.info('🎁 开始发放早期用户奖励...');
    if (specificUserId) {
      logger.info(`📌 指定用户模式: ${specificUserId}`);
    }
    if (testEmailOnly) {
      logger.info('📧 测试邮件模式: 只生成邮件内容，不发送');
    }
    if (forceSendEmail) {
      logger.info('📧 强制发送邮件模式: 即使已有积分也会发送邮件');
    }
    logger.info('='.repeat(70));
    
    // 1. 获取用户列表
    let users;
    if (specificUserId) {
      // 只处理指定用户
      const { data: user, error: userError } = await DatabaseService.getUserById(specificUserId);
      if (userError || !user) {
        throw new Error(`获取用户失败: ${userError?.message || '用户不存在'}`);
      }
      users = [user];
      logger.info(`找到指定用户: ${user.email || user.id}`);
    } else {
      // 获取所有用户
      const { data: allUsers, error: usersError } = await DatabaseService.getAllUsers();
      if (usersError) {
        throw new Error(`获取用户列表失败: ${usersError.message}`);
      }
      if (!allUsers || allUsers.length === 0) {
        logger.warn('没有找到用户');
        return;
      }
      users = allUsers;
      logger.info(`找到 ${users.length} 个用户`);
    }
    
    // 2. 检查并发放积分
    const CREDITS_AMOUNT = 100; // 初始奖励100积分
    const BONUS_CREDITS_AMOUNT = 50; // 链接点击后额外50积分
    const CHANGE_TYPE = 'early_user';
    
    // 硬编码生产环境 URL（用于发送给所有早期用户）
    const FRONTEND_URL = 'https://edunest.app';
    
    // 验证 JWT_SECRET
    if (!config.JWT_SECRET || config.JWT_SECRET === 'dev-secret-key' || config.JWT_SECRET.length < 50) {
      logger.error('❌ 错误: JWT_SECRET 未正确配置！生产环境必须设置强密钥（至少50字符）');
      throw new Error('JWT_SECRET 未正确配置');
    }
    
    logger.info(`📌 前端URL: ${FRONTEND_URL} (生产环境，硬编码)`);
    logger.info(`📌 JWT_SECRET: ✅ 已配置 (${config.JWT_SECRET.length} 字符)`);
    let awardedCount = 0;
    let skippedCount = 0;
    let emailSentCount = 0;
    let emailFailedCount = 0;
    
    for (const user of users) {
      try {
        // 检查是否已经发放过 early_user 积分（100积分）
        const { data: existingCredits } = await DatabaseService.getCreditsHistory(user.id, 10, 0);
        const hasEarlyUserCredit = existingCredits && existingCredits.some(
          credit => credit.change_type === CHANGE_TYPE
        );
        
        // 1. 发放 early_user 积分（100积分）- 如果还没有发放过
        if (!testEmailOnly && !hasEarlyUserCredit) {
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
        } else if (hasEarlyUserCredit) {
          logger.info(`ℹ️  用户 ${user.email} 已有 early_user 积分（100积分），跳过积分发放，继续生成邮件`);
          skippedCount++;
        } else {
          logger.info(`📧 测试模式: 跳过积分发放，只生成邮件内容`);
        }
        
        // 2. 生成奖励链接token（用于额外50积分 - early_user_bonus）
        const bonusToken = jwt.sign(
          { 
            userId: user.id, 
            type: 'early_email_bonus',
            timestamp: Date.now()
          },
          config.JWT_SECRET || 'dev-secret-key',
          { expiresIn: '30d' } // 30天有效期
        );
        const bonusLink = `${FRONTEND_URL}/claim-bonus?token=${bonusToken}`;
        
        // 3. 检查是否已经发送过邮件（通过 early_email_bonus 标记）
        const hasEmailSent = existingCredits && existingCredits.some(
          credit => credit.change_type === 'early_email_bonus'
        );
        
        if (hasEmailSent && !forceSendEmail) {
          logger.info(`📧 用户 ${user.email} 已发送过邮件（已有 early_email_bonus 标记），跳过`);
          continue;
        }
        
        // 4. 生成并处理邮件
        if (user.email) {
          const emailSubject = 'EduNest AI Beta Release - Early User Reward';
          const emailHtml = generateEmailHtml(bonusLink);
          
          if (testEmailOnly) {
            // 测试模式：保存邮件为HTML文件，并尝试发送（如果配置了邮件服务）
            const emailFileName = `email_${user.id}_${Date.now()}.html`;
            const emailFilePath = path.join(__dirname, emailFileName);
            fs.writeFileSync(emailFilePath, emailHtml, 'utf8');
            logger.info(`📧 邮件内容已保存: ${emailFilePath}`);
            logger.info(`📧 收件人: ${user.email}`);
            logger.info(`📧 主题: ${emailSubject}`);
            logger.info(`🔗 Bonus链接: ${bonusLink}`);
            
            // 如果配置了邮件服务，也尝试发送
            const emailHost = process.env.EMAIL_HOST;
            const emailUser = process.env.EMAIL_USERNAME;
            const emailPass = process.env.EMAIL_PASS;
            
            if (emailHost && emailUser && emailPass) {
              logger.info('📧 检测到邮件配置，尝试发送测试邮件...');
              const emailResult = await sendEmail(user.email, emailSubject, emailHtml);
              if (emailResult.success && !emailResult.skip) {
                // 测试模式下也记录标记（如果实际发送成功）
                const { error: markError } = await DatabaseService.addCreditChange(
                  user.id,
                  'early_email_bonus',
                  0  // 金额为0，仅用于标记邮件已发送
                );
                
                if (markError) {
                  logger.warn(`记录邮件发送标记失败: ${user.email}`, markError);
                }
                
                logger.info(`✅ 测试邮件发送成功: ${user.email}`);
                emailSentCount++;
              } else {
                logger.warn(`⚠️  测试邮件发送失败: ${user.email}`, emailResult.error);
                emailFailedCount++;
              }
            }
            
            console.log('\n' + '='.repeat(70));
            console.log('📧 测试邮件已生成');
            console.log('='.repeat(70));
            console.log(`文件路径: ${emailFilePath}`);
            console.log(`收件人: ${user.email}`);
            console.log(`主题: ${emailSubject}`);
            console.log(`Bonus链接: ${bonusLink}`);
            console.log('='.repeat(70) + '\n');
          } else {
            // 正常模式：发送邮件
            const emailResult = await sendEmail(user.email, emailSubject, emailHtml);
            if (emailResult.success && !emailResult.skip) {
              // 邮件发送成功，记录标记（change_amount = 0，仅用于标记）
              const { error: markError } = await DatabaseService.addCreditChange(
                user.id,
                'early_email_bonus',
                0  // 金额为0，仅用于标记邮件已发送
              );
              
              if (markError) {
                logger.warn(`记录邮件发送标记失败: ${user.email}`, markError);
              } else {
                logger.info(`✅ 邮件发送标记已记录: ${user.email}`);
              }
              
              emailSentCount++;
            } else {
              emailFailedCount++;
              if (emailResult.error) {
                logger.error(`邮件发送失败: ${user.email}`, {
                  error: emailResult.error,
                  details: emailResult.details
                });
              }
            }
          }
        } else {
          logger.warn(`用户 ${user.id} 没有邮箱地址，跳过邮件发送`);
        }
        
        // 添加小延迟，避免过快请求
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (userError) {
        logger.error(`处理用户失败: user_id=${user.id}, email=${user.email}`, userError);
        continue;
      }
    }
    
    // 4. 输出统计结果
    logger.info('='.repeat(70));
    logger.info('✅ 早期用户奖励发放完成');
    logger.info('='.repeat(70));
    logger.info(`📊 总用户数: ${users.length}`);
    logger.info(`✅ 成功发放: ${awardedCount} 人`);
    logger.info(`⏭️  跳过（已发放）: ${skippedCount} 人`);
    logger.info(`📧 邮件发送成功: ${emailSentCount} 封`);
    logger.info(`❌ 邮件发送失败: ${emailFailedCount} 封`);
    
    // 检查邮件配置状态
    const emailHost = process.env.EMAIL_HOST;
    const emailUser = process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASS;
    const emailPort = process.env.EMAIL_PORT || '587';
    const hasSMTP = !!(emailHost && emailUser && emailPass);
    const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    
    if (testEmailOnly) {
      // 测试模式下显示邮件配置状态
      logger.info('📧 邮件配置检查:');
      if (hasSMTP) {
        logger.info('   ✅ 邮件服务配置已设置');
        logger.info(`      - HOST: ${emailHost}`);
        logger.info(`      - PORT: ${emailPort || '587'}`);
        logger.info(`      - USER: ${emailUser} (发件人邮箱)`);
      } else if (hasSupabase) {
        logger.info('   ⚠️  SMTP 未配置，但 Supabase 已配置');
        logger.info('   ℹ️  将尝试使用 Supabase Edge Function 发送邮件（需要先创建 send-email 函数）');
      } else {
        logger.warn('   ⚠️  邮件服务未配置');
        logger.warn('   ℹ️  建议: 配置 EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASS 环境变量');
      }
    } else {
      // 正常模式下显示发送结果
      if (emailFailedCount > 0) {
        logger.warn(`⚠️  有 ${emailFailedCount} 封邮件发送失败，请检查邮件配置或手动发送`);
      }
      
      if (emailSentCount === 0 && emailFailedCount === 0 && users.length > 0) {
        logger.warn('⚠️  未发送任何邮件，可能是邮件服务未配置');
        logger.warn('   建议: 配置 SMTP 或手动发送邮件通知用户');
      }
    }
    
    logger.info('='.repeat(70));
    
  } catch (error) {
    logger.error('发放早期用户奖励失败', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const testEmailOnly = args.includes('--test-email');
  const forceSendEmail = args.includes('--force-email');
  const specificUserId = args.find(arg => arg && !arg.startsWith('--') && !arg.includes('node') && !arg.includes('award_early_user_credits')) || null;
  
  awardEarlyUserCredits(specificUserId, testEmailOnly, forceSendEmail)
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
