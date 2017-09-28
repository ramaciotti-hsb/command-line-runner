import React from 'react'
import { Component } from 'react'
import uuidv4 from 'uuid/v4'
import _ from 'lodash'
const spawn = require('child_process').spawn

export default class Container extends Component {

    constructor (props) {
        super(props)
        const uuid = uuidv4()
        this.state = {
            selectedPipelineItemId: uuid,
            pipelineItems: [
                {
                    itemId: uuid,
                    title: 'Pivot To 3 Column File',
                    description: 'Convert a multi column .tsv file from flowjo into an 3 column file suitable for import into Filemaker',
                    workingDirectory: '/Users/nicbarker/Dropbox\ \(Personal\)/CPC\ Work/codebases/CPC-pipeline-project/scripts/',
                    command: [
                        'python3',
                        'pivot-transform-flowjo-into-3-column.py'
                    ],
                    parameters: [
                        { parameter: '--input_file', type: 'file' },
                        { parameter: '--output_file', type: 'file' }
                    ],
                    running: false,
                    error: false,
                    output: ''
                },
                {
                    itemId: uuidv4(),
                    title: 'Import Into Filemaker',
                    description: 'Import a 3 column file into a Filemaker Database.',
                    command: [
                        'python3',
                        '/Users/nicbarker/Dropbox\ \(Personal\)/CPC\ Work/codebases/CPC-pipeline-project/scripts/import-3-column-into-filemaker.py',
                        '--database',
                        'Danisco',
                        '--input_file',
                        '/Users/nicbarker/Dropbox\ \(Personal\)/CPC\ Work/codebases/CPC-pipeline-project/example-files/3-column-example.tsv'
                    ],
                    running: false,
                    error: false,
                    output: ''
                },
                {
                    itemId: uuidv4(),
                    title: 'Export Filemaker Results To Multi Column',
                    description: 'Export the Results table from a filemaker database and pivot to a multi column layout.',
                    command: [
                        'python3',
                        '/Users/nicbarker/Dropbox\ \(Personal\)/CPC\ Work/codebases/CPC-pipeline-project/scripts/filemaker-export-and-pivot-results.py',
                        '--database',
                        'Danisco'
                    ],
                    running: false,
                    error: false,
                    output: ''
                }
            ]
        }
    }

    // Run a command line utility, command is input as an array of arguments
    runCommand (pipelineItemId) {
        const pipelineItem = _.find(this.state.pipelineItems, (item) => {
            return item.itemId === pipelineItemId
        })

        if (!pipelineItem) { return }

        pipelineItem.running = true
        pipelineItem.output = ''
        this.setState({
            pipelineItems: this.state.pipelineItems
        })

        const command = spawn(pipelineItem.command[0], pipelineItem.command.slice(1), { cwd: pipelineItem.workingDirectory })

        command.stdout.on('data', data => {
            pipelineItem.output += data
            this.setState({
                pipelineItems: this.state.pipelineItems
            })
        });

        command.stderr.on('data', data => {
            pipelineItem.output += data
            this.setState({
                pipelineItems: this.state.pipelineItems
            })
        });

        command.on( 'close', code => {
            pipelineItem.running = false
            if (code !== 0) {
                pipelineItem.error = true
            }
            this.setState({
                pipelineItems: this.state.pipelineItems
            })
        });
    }

    selectPipelineItem (pipelineItemId) {
        this.setState({
            selectedPipelineItemId: pipelineItemId
        })
    }

    dropOnParameter (parameter, event) {
        parameter.value = event.dataTransfer.files[0].path
        this.setState({
            pipelineItems: this.state.pipelineItems
        })
        event.preventDefault()
    }

    render () {

        const pipelinesItemsRendered = this.state.pipelineItems.map((item, index) => {
            return (
                <div className={'sidebar-item' + (item.itemId === this.state.selectedPipelineItemId ? ' selected' : '')} key={index} onClick={this.selectPipelineItem.bind(this, item.itemId)}>
                    <div className='number'>#{index + 1}</div>
                    <div className='body'>
                        <div className='title'>{item.title}</div>
                        <div className='description'>{item.description}</div>
                    </div>
                </div>
            )
        })

        const pipelineItem = _.find(this.state.pipelineItems, (item) => {
            return item.itemId === this.state.selectedPipelineItemId
        })

        const itemParameters = pipelineItem.parameters.map((item, index) => {
            // File type parameters
            if (item.type === 'file') {
                return (
                    <div className='parameter' key={index}>
                        <div className='parameter-name'>{item.parameter}</div>
                        <input className='parameter-input' placeholder='Drag and drop a file here or type a path' value={item.parameter.value} onDrop={this.dropOnParameter.bind(this, pipelineItem.itemId, item)} />
                    </div>
                )
            }
        })

        let outputResult
        if (pipelineItem.running === false && pipelineItem.error === true) {
            outputResult = ' error'
        } else if (pipelineItem.running === false) {
            outputResult = ' success'
        }

        return (
            <div className='container'>
                <div className='header'>
                    <h2 className='test'>Ramaciotti Pipeline Runner</h2>
                </div>
                <div className='container-inner'>
                    <div className='sidebar'>
                        {pipelinesItemsRendered}
                    </div>
                    <div className='panel'>
                        <div className='header'>{pipelineItem.title}</div>
                        <div className='panel-inner'>
                            <div className='working-directory'>
                                <div className='title'>Working Directory</div>
                                <div className='body'>{pipelineItem.workingDirectory}</div>
                            </div>
                            <div className='command-string'>
                                <div className='title'>Command to run</div>
                                <div className='command-string-inner'>{pipelineItem.command.join(' ')}</div>
                            </div>
                            <div className='command-parameters'>
                                <div className='title'>Parameters</div>
                                {itemParameters}
                            </div>
                            <div className='command-actions'>
                                <div className='run' onClick={this.runCommand.bind(this, pipelineItem.itemId)}>
                                    <span className="lnr lnr-checkmark-circle"></span>
                                    Run
                                </div>
                            </div>
                            <div className={'command-output' + outputResult}>
                                {pipelineItem.output}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}