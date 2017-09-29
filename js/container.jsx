import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import uuidv4 from 'uuid/v4'
import _ from 'lodash'
import { shell, remote } from 'electron'
const { dialog, Menu, MenuItem } = remote
import path from 'path'
import fs from 'fs'
const spawn = require('child_process').spawn

export default class Container extends Component {

    constructor (props) {
        super(props)
        const uuid = uuidv4()
        const outputFileUuid = uuidv4()
        this.state = {
            selectedPipelineItemId: uuid,
            pipelineItems: []
        }

        // Create the file menu with open, etc
        let menuTemplate = [
            {
                label: 'Command Pipeline',
                submenu: [
                    {role: 'about'},
                    {type: 'separator'},
                    {role: 'services', submenu: []},
                    {type: 'separator'},
                    {role: 'hide'},
                    {role: 'hideothers'},
                    {role: 'unhide'},
                    {type: 'separator'},
                    {role: 'quit'}
                ]
            },
            {
                label: 'File',
                submenu: [
                    {label: 'New Script'},
                    {label: 'Open Script', click: () => { this.openTemplateFile() }},
                    {label: 'Open Pipeline'}
                ]
            }
        ]
        const menu = Menu.buildFromTemplate(menuTemplate)
        Menu.setApplicationMenu(menu)
    }

    openTemplateFile () {
        // Let the user open a saved template of a script or pipeline file
        dialog.showOpenDialog({ title: `Open Script File`, filters: [{ name: 'CLR script templates', extensions: ['json']}], message: `Open Script File`, properties: ['openFile', 'multiSelections'] }, (path) => {
            if (path) {
                // Loop through if multiple files were selected
                for (let file of path) {
                    fs.readFile(file, (err, data) => {
                        if (err) throw err;
                        let pipelineItem = JSON.parse(data)
                        this.state.pipelineItems.push(pipelineItem)
                        this.setState({
                            selectedPipelineItemId: pipelineItem.id,
                            pipelineItems: this.state.pipelineItems
                        })
                    });
                }
            }
        })
    }

    // Run a command line utility, command is input as an array of arguments
    runCommand (pipelineItemId) {
        const pipelineItem = _.find(this.state.pipelineItems, (item) => {
            return item.id === pipelineItemId
        })

        if (!pipelineItem) { return }

        const commandArray = [].concat(pipelineItem.command)
        // Add any defined parameters to the command
        pipelineItem.parameters.map((parameter) => {
            if (parameter.value) {
                commandArray.push(parameter.parameter)
                commandArray.push(parameter.value)
            }
        })

        pipelineItem.running = true
        pipelineItem.output = commandArray.join(' ') + "\n\n"
        pipelineItem.runningCommand = spawn(commandArray[0], commandArray.slice(1), { cwd: pipelineItem.workingDirectory })

        this.setState({
            pipelineItems: this.state.pipelineItems
        })

        let writeStdout = (data) => {
            pipelineItem.output += data + "\n"
            this.setState({
                pipelineItems: this.state.pipelineItems
            }, () => {
                // Scroll output container to bottom
                const outputContainer = ReactDOM.findDOMNode(this.refs.commandOutput)
                outputContainer.scrollTop = outputContainer.scrollHeight
            })
        }

        pipelineItem.runningCommand.stdout.on('data', writeStdout);
        pipelineItem.runningCommand.stderr.on('data', writeStdout);

        pipelineItem.runningCommand.on( 'close', code => {
            pipelineItem.running = false
            pipelineItem.status = code !== 0 ? 'error' : 'success'
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

    handleDroppableInputChange (parameterId, event) {
        let parameter
        for (let item of this.state.pipelineItems) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) { break }
        }

        if (event.type === 'change') {
            parameter.value = event.target.value
        } else if (event.type === 'drop') {
            parameter.value = event.dataTransfer.files[0].path
        }
        this.setState({
            pipelineItems: this.state.pipelineItems
        })
        event.preventDefault()
    }

    handleStdinInputChange(pipelineItemId, event) {
        const pipelineItem = _.find(this.state.pipelineItems, item => item.id === pipelineItemId)

        if (!pipelineItem) { return }

        pipelineItem.stdinInputValue = event.target.value

        this.setState({
            pipelineItems: this.state.pipelineItems
        })
    }

    handleStdinKeyPress (pipelineItemId, event) {
        const pipelineItem = _.find(this.state.pipelineItems, item => item.id === pipelineItemId)

        if (!pipelineItem) { return }

        if (event.key === 'Enter') {
            if (pipelineItem.runningCommand) {
                pipelineItem.runningCommand.stdin.write(pipelineItem.stdinInputValue + '\n')
                pipelineItem.output += pipelineItem.stdinInputValue + '\n'
                pipelineItem.stdinInputValue = ''
                this.setState({
                    pipelineItems: this.state.pipelineItems
                })
            }
        }
    }

    openFileParameterDialog (parameterId, dialogOptions) {
        // Find the parameter
        let parameter
        let pipelineItem
        for (let item of this.state.pipelineItems) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) {
                pipelineItem = item
                break
            }
        }
        if (!parameter) { return }

        dialog.showOpenDialog({ title: `Select ${parameter.parameter}`, defaultPath: pipelineItem.workingDirectory.replace('\\', ''), message: `Select ${parameter.parameter}`, properties: dialogOptions }, (path) => {
            if (path) {
                parameter.value = path[0]
                this.setState({
                    pipelineItems: this.state.pipelineItems
                })
            }
        })
    }

    savePipelineItemToFile (pipelineItemId) {
        const pipelineItem = _.find(this.state.pipelineItems, item => item.id === pipelineItemId)

        if (!pipelineItem) { return }

        // Prevent runtime data from leaking into the json schema for this script
        pipelineItem.toJSON = function () {
            return _.omit(this, [ 'runningCommand', 'running', 'error', 'output', 'status', 'stdinInputValue'])
        };

        dialog.showSaveDialog({ title: `Save ${pipelineItem.title}`, defaultPath: pipelineItem.workingDirectory.replace('\\', '') + pipelineItem.title.replace(/\ /g, '-').toLowerCase() + '.json', message: `Save ${pipelineItem.title}` }, (path) => {
            if (path) {
                fs.writeFile(path, JSON.stringify(pipelineItem, null, 4), function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    console.log("The file was saved!");
                });
            }
        })
    }

    render () {
        const pipelinesItemsRendered = this.state.pipelineItems.map((item, index) => {
            return (
                <div className={'sidebar-item' + (item.id === this.state.selectedPipelineItemId ? ' selected' : '')} key={index} onClick={this.selectPipelineItem.bind(this, item.id)}>
                    <div className='number'>#{index + 1}</div>
                    <div className='body'>
                        <div className='title'>{item.title}</div>
                        <div className='description'>{item.description}</div>
                    </div>
                </div>
            )
        })

        const pipelineItem = _.find(this.state.pipelineItems, (item) => {
            return item.id === this.state.selectedPipelineItemId
        })

        let panel = <div className='panel'></div>

        if (pipelineItem) {
            const itemParameters = pipelineItem.parameters.map((parameter, index) => {
                // File type parameters
                if (parameter.type === 'file') {
                    return (
                        <div className='parameter' key={index}>
                            <div className='parameter-name'>{parameter.parameter}</div>
                            <input className={'parameter-input' + (parameter.highlight ? ' highlight' : '')} placeholder='Drag and drop a file here or type a path' value={parameter.value} onChange={this.handleDroppableInputChange.bind(this, parameter.id)} onDrop={this.handleDroppableInputChange.bind(this, parameter.id)} />
                            <div className='file-select' onClick={this.openFileParameterDialog.bind(this, parameter.id, ['openFile'])}>
                                <i className='lnr lnr-file-add'></i>
                                Select File
                            </div>
                        </div>
                    )
                }
                // String type parameters
                if (parameter.type === 'string') {
                    return (
                        <div className='parameter' key={index}>
                            <div className='parameter-name'>{parameter.parameter}</div>
                            <input className={'parameter-input'} placeholder={parameter.placeholder} value={parameter.value} onChange={this.handleDroppableInputChange.bind(this, parameter.id)} />
                        </div>
                    )
                }
            })

            let outputResult
            if (pipelineItem.running === false) {
                if (pipelineItem.status === 'error') {
                    outputResult = ' error'
                } else if (pipelineItem.status === 'success') {
                    outputResult = ' success'
                } else {
                    outputResult = ' idle'
                }
            } else {
                outputResult = ' running'
            }

            // Show output files
            let outputFilesInner
            if (pipelineItem.outputFile.type !== 'none' && pipelineItem.status === 'success') {
                // If there is a parameter specified as an output file, use it's value
                let filePath
                if (pipelineItem.outputFile.type === 'parameter') {
                    const parameter = _.find(pipelineItem.parameters, { id: pipelineItem.outputFile.id })
                    filePath = parameter.value
                } else if (pipelineItem.outputFile.type === 'path') {
                    filePath = pipelineItem.outputFile.path
                }
                
                // Check relative vs absolute path
                if (filePath[0] !== '/') {
                    filePath = pipelineItem.workingDirectory + filePath
                }

                filePath = path.normalize(filePath)

                outputFilesInner = (
                    <div className='output-files'>
                        <div className='header'>Output files:</div>
                        <div className='output-file' onClick={shell.showItemInFolder.bind(null, filePath)}>{filePath}</div>
                    </div>
                )
            }

            panel = (
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
                            <div className='run' onClick={this.runCommand.bind(this, pipelineItem.id)}>
                                <span className="lnr lnr-checkmark-circle"></span>
                                Run
                            </div>
                            <div className='save' onClick={this.savePipelineItemToFile.bind(this, pipelineItem.id)}>
                                <span className="lnr lnr-download"></span>
                                Save
                            </div>
                        </div>
                        {outputFilesInner}
                        <div className={'command-output' + outputResult} ref="commandOutput">
                            {pipelineItem.output}
                        </div>
                        <div className='stdin-outer'>
                            <input type="text" placeholder="Type here to send input to the program" value={pipelineItem.stdinInputValue} onChange={this.handleStdinInputChange.bind(this, pipelineItem.id)} onKeyPress={this.handleStdinKeyPress.bind(this, pipelineItem.id)} />
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className='container'>
                {/*<div className='header'>
                    <h2 className='test'>Ramaciotti Pipeline Runner</h2>
                </div>*/}
                <div className='container-inner'>
                    <div className='sidebar'>
                        {pipelinesItemsRendered}
                    </div>
                    {panel}
                </div>
            </div>
        )
    }
}