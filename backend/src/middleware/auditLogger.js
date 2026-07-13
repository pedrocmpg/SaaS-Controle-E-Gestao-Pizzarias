const prisma = require("../lib/prisma");
const { securityLogger } = require("../lib/logger");

/**
 * Middleware para registrar mudanças no catálogo em AuditLog
 * Intercepta requisições POST/PUT/DELETE para tabelas auditadas
 * 
 * Uso:
 * router.post("...", auditCatalogChange("PizzaSize"), handler)
 * router.put("...", auditCatalogChange("Flavor"), handler)
 * router.delete("...", auditCatalogChange("Border"), handler)
 */

/**
 * Faz fetch do registro antes de qualquer mudança (para snapshots)
 * @param {string} table - Nome da tabela (PizzaSize, Flavor, Border, Product)
 * @param {number} recordId - ID do registro
 * @returns {Promise<Object|null>}
 */
async function getRecordBefore(table, recordId) {
  try {
    const prismaModel = prisma[table.charAt(0).toLowerCase() + table.slice(1)];
    if (!prismaModel) return null;
    return await prismaModel.findUnique({ where: { id: recordId } });
  } catch (err) {
    console.error(`Erro ao buscar registro anterior (${table}:${recordId}):`, err.message);
    return null;
  }
}

/**
 * Cria entrada no AuditLog
 * @param {string} table - Nome da tabela
 * @param {number} recordId - ID do registro
 * @param {string} action - "CREATE", "UPDATE", "DELETE"
 * @param {Object} before - Dados antes (null se CREATE)
 * @param {Object} after - Dados depois (null se DELETE)
 * @param {number} adminId - ID do admin que fez a mudança
 * @param {string} ip - IP do cliente
 * @param {string} userAgent - User-Agent do cliente
 */
async function logAuditChange(table, recordId, action, before, after, adminId, ip, userAgent) {
  try {
    await prisma.auditLog.create({
      data: {
        table,
        recordId,
        action,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
        adminId,
        ip,
        userAgent: userAgent || null,
        timestamp: new Date(),
      },
    });

    // Log também na security logger
    securityLogger.info(`CATALOG_${action}`, {
      table,
      recordId,
      adminId,
      ip,
      action,
    });
  } catch (err) {
    console.error("Erro ao registrar auditoria:", err.message);
    securityLogger.error("AUDIT_LOG_FAILED", {
      table,
      recordId,
      action,
      error: err.message,
    });
  }
}

/**
 * Middleware para interceptar e registrar mudanças no catálogo
 * 
 * Para POST (CREATE):
 *   - Captura body completo como "after"
 *   - before = null
 * 
 * Para PUT (UPDATE):
 *   - Busca registro antes
 *   - Captura mudanças no body
 *   - Registra before e after
 * 
 * Para DELETE:
 *   - Busca registro antes
 *   - Registra before
 *   - after = null
 * 
 * @param {string} table - Nome da tabela (PizzaSize, Flavor, Border, Product)
 * @returns {Function} Middleware Express
 */
function auditCatalogChange(table) {
  return async (req, res, next) => {
    try {
      const method = req.method;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("user-agent");
      const adminId = req.admin?.id;

      // Se for POST (CREATE), basta capturar o body
      if (method === "POST") {
        // Chama handler e captura resposta
        const originalJson = res.json;
        res.json = function(data) {
          // data é o objeto criado retornado pelo handler
          logAuditChange(
            table,
            data.id, // ID do novo registro
            "CREATE",
            null, // Sem "before" em criação
            data,  // "after" é o novo registro
            adminId,
            ip,
            userAgent
          ).catch(err => console.error("Erro ao logar auditoria POST:", err));

          // Retorna resposta original
          return originalJson.call(this, data);
        };

        return next();
      }

      // Para PUT e DELETE, precisa do ID da URL
      const recordId = parseInt(req.params.id);
      if (isNaN(recordId)) {
        return next();
      }

      // Busca dados antes da mudança
      const before = await getRecordBefore(table, recordId);

      if (method === "PUT" || method === "PATCH") {
        // Intercepta resposta do handler
        const originalJson = res.json;
        res.json = function(data) {
          logAuditChange(
            table,
            recordId,
            "UPDATE",
            before,
            data, // data é o registro atualizado
            adminId,
            ip,
            userAgent
          ).catch(err => console.error("Erro ao logar auditoria PUT:", err));

          return originalJson.call(this, data);
        };

        return next();
      }

      if (method === "DELETE") {
        // Intercepta resposta do handler
        const originalSend = res.send;
        const originalStatus = res.status;

        res.status = function(code) {
          // Se delete foi bem-sucedido (204, 200), registra auditoria
          if (code === 204 || code === 200) {
            logAuditChange(
              table,
              recordId,
              "DELETE",
              before, // Snapshots dados que foram deletados
              null,   // Sem "after" em deleção
              adminId,
              ip,
              userAgent
            ).catch(err => console.error("Erro ao logar auditoria DELETE:", err));
          }

          return originalStatus.call(this, code);
        };

        return next();
      }

      next();
    } catch (err) {
      console.error("Erro no middleware auditLogger:", err);
      next(err);
    }
  };
}

module.exports = {
  auditCatalogChange,
  logAuditChange,
  getRecordBefore,
};
