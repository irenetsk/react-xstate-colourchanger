import { MachineConfig, send, Action, assign } from "xstate";
import { loadGrammar } from './runparser'
import { parse } from './chartparser'
import { grammar } from './grammars/SmartHome'

export const GrammarSearch = (input: any) => {
    const gram = loadGrammar(grammar)
    const prs = parse(input.split(/\s+/), gram)
    const result = prs.resultsForRule(gram.$root)[0]
    return [result.command.action, result.command.object]}

export function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')}

export function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: {
                RECOGNISED: [
                    {actions: [
                        assign((context) => { return  {action: GrammarSearch(context.recResult)[0] }}), 
                            assign((context) => { return { object: GrammarSearch(context.recResult)[1] }})],
                    target: "answer"},
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: "Welcome. What would you like me to do?"
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("I'm sorry, I'm not programmed to do that"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        answer: {            
            entry: send('RECOGNISED'),
            on: {RECOGNISED: [
                    { target: 'case1', cond: (context) => GrammarSearch(context.recResult)[1] === ("light" || "heat" || "air conditioning") },
                    { target: 'case2', cond: (context) => ( GrammarSearch(context.recResult)[1] === "window"|| GrammarSearch(context.recResult)[1] === "door")}
                ]
                // If not recognised, it will break down and not lead to either case.
            },
        },
        case1: {
            initial: "prompt",
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. Turning the ${context.object} ${context.action}` })),
            }
        }
    },
        case2: {
             initial: "prompt",
             states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. I will ${context.action} the ${context.object}` }))
                    }
                }
        }



    }
})
