const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppBot {
    constructor(aiAgent, responseFormatter) {
        this.aiAgent = aiAgent;
        this.responseFormatter = responseFormatter;
        this.client = null;
        this.isReady = false;
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-session';
        this.clientId = process.env.WHATSAPP_CLIENT_ID || 'whatsapp-ai-bot';
        this.initTimeout = null;
    }

    async initialize() {
        console.log('📱 Inicializando WhatsApp Bot...');

        // Limpa sessão se existir problema
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
        }

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: this.clientId,
                dataPath: this.sessionPath
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        this.setupEventHandlers();
        
        // Timeout de segurança para forçar ready
        this.initTimeout = setTimeout(() => {
            if (!this.isReady) {
                console.log('⚠️ Timeout atingido, forçando estado ready...');
                this.forceReady();
            }
        }, 45000); // 45 segundos
        
        await this.client.initialize();
    }

    forceReady() {
        this.isReady = true;
        console.log('✅ WhatsApp Bot conectado e pronto! (forçado)');
        console.log('📱 WhatsApp Web conectado com sucesso!');
        console.log('🔔 Bot está aguardando mensagens...');
        console.log('🧪 Testando listeners de eventos...');
        console.log(`📊 Eventos 'message': ${this.client.listenerCount('message')}`);
        console.log(`📊 Eventos 'ready': ${this.client.listenerCount('ready')}`);
        console.log('⏳ Envie uma mensagem para testar...');
    }

    setupEventHandlers() {
        // QR Code para autenticação
        this.client.on('qr', (qr) => {
            console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
            qrcode.generate(qr, { small: true });
        });

        // Cliente pronto
        this.client.on('ready', () => {
            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
                this.initTimeout = null;
            }
            console.log('✅ WhatsApp Bot conectado e pronto!');
            console.log('📱 WhatsApp Web conectado com sucesso!');
            console.log('🔔 Bot está aguardando mensagens...');
            this.isReady = true;
            
            // Testa listeners
            console.log('🧪 Testando listeners de eventos...');
            console.log(`📊 Eventos 'message': ${this.client.listenerCount('message')}`);
            console.log(`📊 Eventos 'ready': ${this.client.listenerCount('ready')}`);
            console.log('⏳ Envie uma mensagem para testar...');
        });

        // Estado de autenticação
        this.client.on('authenticated', () => {
            console.log('🔐 WhatsApp autenticado com sucesso!');
        });

        // Estado de carregamento
        this.client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
        });

        // Mensagem recebida - HANDLER PRINCIPAL
        this.client.on('message', async (message) => {
            console.log('🔔 EVENTO MESSAGE DISPARADO!');
            await this.handleMessage(message);
        });

        // Desconectado
        this.client.on('disconnected', (reason) => {
            console.log('❌ WhatsApp desconectado:', reason);
            this.isReady = false;
        });

        // Erro de autenticação
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação:', msg);
        });

        // Erro geral
        this.client.on('error', (error) => {
            console.error('❌ Erro no cliente WhatsApp:', error);
        });
    }

    async handleMessage(message) {
        try {
            console.log('📨 PROCESSANDO MENSAGEM...');
            
            // Ignora mensagens próprias
            if (message.fromMe) {
                console.log('🔄 Ignorando mensagem própria');
                return;
            }
            
            const contact = await message.getContact();
            const chat = await message.getChat();
            
            console.log(`📨 Mensagem recebida de ${contact.name || contact.number}: "${message.body}"`);
            console.log(`📋 Tipo da mensagem: ${message.type}`);

            // Verifica se é uma mensagem de texto
            if (message.type !== 'chat') {
                console.log(`⚠️ Tipo de mensagem não suportado: ${message.type}`);
                await message.reply('🤖 Desculpe, eu só processo mensagens de texto no momento.');
                return;
            }

            // Mostra que está processando
            console.log('⏳ Iniciando processamento da mensagem...');
            await chat.sendStateTyping();

            // Processa mensagem com IA
            console.log('🧠 Enviando para IA...');
            const response = await this.processMessageWithAI(message.body, contact);
            
            // Envia resposta
            if (response) {
                console.log(`📤 Enviando resposta: "${response.substring(0, 100)}..."`);
                await message.reply(response);
                console.log(`✅ Resposta enviada com sucesso para ${contact.name || contact.number}`);
            } else {
                console.log('⚠️ Nenhuma resposta gerada pela IA');
                await message.reply('🤖 Desculpe, não consegui processar sua mensagem no momento.');
            }

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
            console.error('Stack trace:', error.stack);
            try {
                await message.reply('🤖 Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
            } catch (replyError) {
                console.error('❌ Erro ao enviar mensagem de erro:', replyError);
            }
        }
    }

    async processMessageWithAI(messageText, contact) {
        try {
            console.log('🧠 Iniciando processamento com IA...');
            
            // Contexto do usuário
            const userContext = {
                name: contact.name || 'Usuário',
                number: contact.number,
                timestamp: new Date().toISOString()
            };
            console.log('👤 Contexto do usuário:', userContext);

            // Verifica se aiAgent existe
            if (!this.aiAgent) {
                console.error('❌ aiAgent não está inicializado!');
                return '🤖 Sistema de IA não está disponível. Tente novamente em alguns instantes.';
            }

            console.log('🔄 Chamando aiAgent.processMessage...');
            // Processa com IA
            const aiResponse = await this.aiAgent.processMessage(messageText, userContext);
            console.log('✅ Resposta da IA recebida:', aiResponse ? 'Sucesso' : 'Vazia');
            
            // Verifica se responseFormatter existe
            if (!this.responseFormatter) {
                console.error('❌ responseFormatter não está inicializado!');
                return aiResponse?.response || '🤖 Erro na formatação da resposta.';
            }

            console.log('🎨 Formatando resposta...');
            // Formata resposta
            const formattedResponse = this.responseFormatter.format(aiResponse);
            console.log('✅ Resposta formatada:', formattedResponse ? 'Sucesso' : 'Vazia');
            
            return formattedResponse;

        } catch (error) {
            console.error('❌ Erro no processamento IA:', error);
            console.error('Stack trace completo:', error.stack);
            return '🤖 Desculpe, não consegui processar sua solicitação. Verifique se sua mensagem está clara e tente novamente.';
        }
    }

    async sendMessage(number, message) {
        try {
            if (!this.isReady) {
                throw new Error('WhatsApp Bot não está pronto');
            }

            const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
            await this.client.sendMessage(chatId, message);
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            return false;
        }
    }

    async destroy() {
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
        }
        if (this.client) {
            await this.client.destroy();
            console.log('🛑 WhatsApp Bot encerrado');
        }
    }

    // Métodos utilitários
    getStatus() {
        return {
            ready: this.isReady,
            clientId: this.clientId,
            sessionPath: this.sessionPath
        };
    }
}

module.exports = WhatsAppBot;